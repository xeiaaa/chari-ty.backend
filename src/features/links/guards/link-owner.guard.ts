import {
  CanActivate,
  ExecutionContext,
  Injectable,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { Request } from 'express';
import { PrismaService } from '../../../core/prisma/prisma.service';
import { FundraiserLink, User } from 'generated/prisma';

@Injectable()
export class LinkOwnerGuard implements CanActivate {
  constructor(private prisma: PrismaService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req: Request & {
      link: FundraiserLink;
      authUser: User;
    } = context.switchToHttp().getRequest();
    const user = req.authUser;
    const linkId = req.params.linkId;

    if (!user || !linkId) {
      throw new ForbiddenException('Unauthorized access');
    }

    // Get the fundraiser link
    const link = await this.prisma.fundraiserLink.findUnique({
      where: { id: linkId },
    });

    if (!link) {
      throw new NotFoundException('Link not found');
    }

    // Check if the authenticated user owns this link
    if (link.userId !== user.id) {
      throw new ForbiddenException(
        'You do not have permission to access this link',
      );
    }

    // Attach link to request for reuse in controller
    req.link = link;

    return true;
  }
}
