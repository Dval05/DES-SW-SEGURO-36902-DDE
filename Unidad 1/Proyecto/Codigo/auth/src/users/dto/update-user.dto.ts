import { PartialType } from '@nestjs/swagger';
import { CreateUserDto } from './create-user.dto';
// Omitted fields are optional; explicit null must still pass the original validators.
export class UpdateUserDto extends PartialType(CreateUserDto, {
  skipNullProperties: false,
}) {}
