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
import { BLF } from '@blamnetwork/blf_lsp';

@ApiTags('User Storage')
@Controller('/storage/user')
export class UserStorageController {
  constructor(
    @Inject(ILoggerSymbol) private readonly logger: ILogger,
    private readonly queryBus: QueryBus,
    private readonly commandBus: CommandBus,
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
    let user: User = await this.queryBus.execute(
      new GetUserQuery(new UserID(xuid)),
    );

    if (!user)
      user = await this.commandBus.execute(
        new CreateUserCommand(new UserID(xuid)),
      );

    let srid = {
      is_elite: user.serviceRecord.model.valueOf(),
      spartan_left_shoulder: user.serviceRecord.spartanLeftShounder.valueOf(),
      total_exp: user.serviceRecord.totalEXP,
      primary_color: user.serviceRecord.primaryColor.valueOf(),
      secondary_color: user.serviceRecord.secondaryColor.valueOf(),
      tertiary_color: user.serviceRecord.tertiaryColor.valueOf(),
      emblem_primary_color: user.serviceRecord.emblemPrimaryColor.valueOf(),
      emblem_secondary_color: user.serviceRecord.emblemSecondaryColor.valueOf(),
      emblem_background_color: user.serviceRecord.emblemBackgroundColor.valueOf(),
      spartan_helmet: user.serviceRecord.spartanHelmet.valueOf(),
      spartan_right_shoulder: user.serviceRecord.spartanRightShoulder.valueOf(),
      spartan_body: user.serviceRecord.spartanBody.valueOf(),
      elite_helmet: user.serviceRecord.eliteHelmet.valueOf(),
      elite_body: user.serviceRecord.eliteBody.valueOf(),
      elite_left_shoulder: user.serviceRecord.eliteLeftShoulder.valueOf(),
      elite_right_shoulder: user.serviceRecord.eliteRightShoulder.valueOf(),
      rank: user.serviceRecord.rank.valueOf(),
      player_name: user.serviceRecord.playerName,
      appearance_flags: user.serviceRecord.appearanceFlags,
      foreground_emblem: user.serviceRecord.foregroundEmblem,
      background_emblem: user.serviceRecord.backgroundEmblem,
      emblem_flags: user.serviceRecord.emblemFlags,
      service_tag: user.serviceRecord.serviceTag,
      campaign_progress: user.serviceRecord.campaignProgress,
      highest_skill: user.serviceRecord.highestSkill,
      unknown_insignia: user.serviceRecord.unknownInsignia,
      unknown_insignia2: user.serviceRecord.unknownInsignia2,
      grade: user.serviceRecord.grade,
    };

    console.log(JSON.stringify(srid));

    return new StreamableFile(BLF.halo3.build_user_file(srid), { disposition: "filename=user.bin" });
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
