import { ApiProperty } from '@nestjs/swagger';
import {
  IsEmail,
  IsIn,
  IsNotEmpty,
  IsString,
  MinLength,
} from 'class-validator';
import { UserRole } from '../enums/user-role.enum';

export class RegisterDto {
  @ApiProperty({ example: 'user@company.com' })
  @IsEmail()
  email: string;

  @ApiProperty({ minLength: 8 })
  @IsString()
  @IsNotEmpty()
  @MinLength(8)
  password: string;

  @ApiProperty({ example: 'John' })
  @IsString()
  @IsNotEmpty()
  firstName: string;

  @ApiProperty({ example: 'Doe' })
  @IsString()
  @IsNotEmpty()
  lastName: string;

  @ApiProperty({
    enum: [UserRole.MANAGER, UserRole.AGENT],
    default: UserRole.AGENT,
    description: 'Only manager or agent roles can be invited. Use /auth/register-company to create an admin.',
  })
  @IsIn([UserRole.MANAGER, UserRole.AGENT], {
    message: 'role must be manager or agent — admins are created via /auth/register-company',
  })
  role: UserRole;
}
