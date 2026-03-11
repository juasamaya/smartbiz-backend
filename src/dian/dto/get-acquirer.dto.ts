import { IsString, IsNotEmpty, Length, IsIn } from 'class-validator';

export class GetAcquirerDto {
  @IsString()
  @IsNotEmpty()
  @IsIn(['13', '31', '11', '12', '21', '22', '41', '42'], { message: 'Invalid Identification Type per DIAN table' })
  identificationType: string;

  @IsString()
  @IsNotEmpty()
  @Length(5, 20)
  identificationNumber: string;
}