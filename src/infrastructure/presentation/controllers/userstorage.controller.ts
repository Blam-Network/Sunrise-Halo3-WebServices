import {
  Controller,
  Get,
  Inject,
  NotFoundException,
  Param,
  Res,
  StreamableFile,
} from '@nestjs/common';
import ILogger, { ILoggerSymbol } from '../../../ILogger';
import { CommandBus, QueryBus } from '@nestjs/cqrs';
import { createReadStream } from 'fs';
import { join } from 'path';
import { ApiParam, ApiTags } from '@nestjs/swagger';
import { stat } from 'fs/promises';
import { Response } from 'express';
import ServiceRecord from '../blf/ServiceRecord';
import PlayerData from '../blf/PlayerData';
import UserBans from '../blf/UserBans';
import FileQueue from '../blf/FileQueue';
import { getBuffer } from '../blf/UserFile';
import { GetUserQuery } from 'src/application/queries/GetUserQuery';
import UserID from 'src/domain/value-objects/UserId';
import User from 'src/domain/aggregates/User';
import { CreateUserCommand } from 'src/application/commands/CreateUserCommand';
import OmahaPlayerData from '../blf/OmahaPlayerData';
import { BLF, s_blf_chunk_player_data, s_blf_chunk_service_record } from '@blamnetwork/blf_lsp';
import { PrismaService } from 'src/db/prisma.service';

@ApiTags('User Storage')
@Controller('/storage/user')
export class UserStorageController {
  constructor(
    @Inject(ILoggerSymbol) private readonly logger: ILogger,
    private readonly queryBus: QueryBus,
    private readonly commandBus: CommandBus,
    private readonly prisma: PrismaService
  ) {}

  @Get('/:unk1/:unk2/:xuid/user.bin')
  @ApiParam({ name: 'xuid', example: '000000000000EAD3' })
  async getBetaUser(
    @Param('xuid') xuid: string,
    @Res({ passthrough: true }) res: Response,
  ) {
    return await this.getUser(xuid, res);
  }

  @Get('/:titleId/:unk1/:unk2/:unk3/:xuid/user.bin')
  @ApiParam({ name: 'xuid', example: '000000000000EAD3' })
  async getOmahaUser(
    @Param('xuid') xuid: string,
    @Res({ passthrough: true }) res: Response,
  ) {
    return await this.getUser(xuid, res, true);
  }

  @Get('/:titleId/:unk1/:unk2/:unk3/:xuid/recent_players.bin')
  @ApiParam({ name: 'xuid', example: '000000000000EAD3' })
  async getOmahaRecentPlayers(
    @Param('xuid') xuid: string,
    @Res({ passthrough: true }) res: Response,
  ) {
    return await this.getRecentPlayers(xuid, res);
  }

  @Get('/:unk1/:unk2/:unk3/:xuid/user.bin')
  @ApiParam({ name: 'xuid', example: '000000000000EAD3' })
  async getUser(
    @Param('xuid') xuid: string,
    @Res({ passthrough: true }) res: Response,
    reach = false,
  ) {
    const serviceRecord = await this.prisma.service_record.findUnique({ where: { player_xuid: BigInt("0x" + xuid) }});
    const playerData = await this.prisma.player_data.findUnique({where: {player_xuid: BigInt("0x" + xuid)}});

    let fupd: s_blf_chunk_player_data;

    if (playerData) {
      let bungie_user_role = 0;
      bungie_user_role | 1 << 1; // give everyone the seventh column
      if (playerData.is_pro) bungie_user_role | 1 << 1;
      if (playerData.is_bungie) bungie_user_role | 1 << 2;
      if (playerData.has_recon || playerData.road_to_recon_completed) bungie_user_role | 1 << 3;
      fupd = {
        ...playerData,
        bungie_user_role,
        hopper_directory: playerData.hopper_directory_override || 'default_hoppers'
      }
    }

    const blfFile = BLF.halo3.build_user_file(
      serviceRecord, 
      fupd
    );

    return new StreamableFile(blfFile, { disposition: "filename=user.bin" });
  }

  @Get('/:unk1/:unk2/:unk3/:xuid/recent_players.bin')
  @ApiParam({ name: 'xuid', example: '000000000000EAD3' })
  async getRecentPlayers(
    @Param('xuid') xuid: string,
    @Res({ passthrough: true }) res: Response,
  ) {
    // return await this.sendLocalFile(
    //   `${unk1}/${unk2}/${unk3}/${xuid}/recent_players.bin`,
    //   res,
    // );

    return await this.sendLocalFile(`recent_players.bin`, res);
  }

  @Get('/:unk1/:unk2/:xuid/recent_players_hopper_08.bin')
  @ApiParam({ name: 'xuid', example: '000000000000EAD3' })
  async getDeltaRecentPlayers(
    @Param('xuid') xuid: string,
    @Res({ passthrough: true }) res: Response,
  ) {
    return await this.sendLocalFile(`recent_players.bin`, res);
  }

  private async sendLocalFile(path: string, res: Response) {
    path = join(process.cwd(), `public/storage/user/`, path);

    const stats = await stat(path);

    if (!stats.isFile()) throw new NotFoundException();

    res.set('Content-Length', stats.size.toString());
    res.set('Cache-Control', 'no-cache');
    return new StreamableFile(createReadStream(path));
  }
}
