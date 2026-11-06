import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsIn,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUrl,
  MaxLength,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

export class MercadoLivreProductAttributeDto {
  @ApiProperty({ example: 'BRAND' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  id: string;

  @ApiPropertyOptional({ example: 'EasySell' })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  valueName?: string;

  @ApiPropertyOptional({ example: '123456' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  valueId?: string;
}

export class MercadoLivreProductListingDto {
  @ApiProperty({ example: 'MLB1234' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(30)
  categoryId: string;

  @ApiProperty({ enum: ['new', 'used', 'not_specified'] })
  @IsIn(['new', 'used', 'not_specified'])
  condition: 'new' | 'used' | 'not_specified';

  @ApiProperty({ example: 'gold_special' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(50)
  listingTypeId: string;

  @ApiProperty({
    type: [String],
    example: ['https://cdn.example.com/product-front.jpg'],
  })
  @IsArray()
  @ArrayMinSize(1)
  @IsUrl({ require_protocol: true }, { each: true })
  pictures: string[];

  @ApiProperty({ example: 'me2' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(50)
  shippingMode: string;

  @ApiProperty({ example: false })
  @IsBoolean()
  freeShipping: boolean;

  @ApiProperty({ example: false })
  @IsBoolean()
  localPickup: boolean;

  @ApiPropertyOptional({ type: [MercadoLivreProductAttributeDto] })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => MercadoLivreProductAttributeDto)
  attributes?: MercadoLivreProductAttributeDto[];
}
