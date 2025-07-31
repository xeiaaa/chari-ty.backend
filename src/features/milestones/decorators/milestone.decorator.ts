import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { Request } from 'express';
import { Fundraiser, Milestone } from 'generated/prisma';

export const MilestoneParam = createParamDecorator(
  (data: unknown, ctx: ExecutionContext) => {
    const request: Request & {
      milestone: Milestone & {
        fundraiser: Fundraiser;
      };
    } = ctx.switchToHttp().getRequest();
    return request.milestone;
  },
);
