import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { Request } from 'express';
import { Fundraiser } from 'generated/prisma';

export const FundraiserParam = createParamDecorator(
  (data: unknown, ctx: ExecutionContext) => {
    const request: Request & { fundraiser: Fundraiser } = ctx
      .switchToHttp()
      .getRequest();
    return request.fundraiser;
  },
);
