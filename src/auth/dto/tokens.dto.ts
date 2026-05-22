import { ApiProperty } from '@nestjs/swagger';

export class AuthResponseDto {
  @ApiProperty({ description: 'ISO 8601 expiry timestamp of the access token' })
  accessTokenExpiresAt: string;

  @ApiProperty({ description: 'ISO 8601 expiry timestamp of the refresh token' })
  refreshTokenExpiresAt: string;
}
