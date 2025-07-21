import { Controller } from '@nestjs/common';
import { GroupsService } from './groups.service';

/**
 * Groups controller for authenticated endpoints
 */
@Controller('groups')
export class GroupsController {
  constructor(private readonly groupsService: GroupsService) {}

  // TODO: Add authenticated group endpoints as needed
}
