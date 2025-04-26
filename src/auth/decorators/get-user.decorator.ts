// src/auth/decorators/get-user.decorator.ts
import { createParamDecorator, ExecutionContext } from '@nestjs/common';

/**
 * Custom decorator to extract the user object from the request
 * Can be used as @GetUser() user: User or @GetUser('email') email: string
 */
export const GetUser = createParamDecorator(
  (data: string | undefined, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest();
    const user = request.user;

    if (!user) {
      return null;
    }

    // If data is provided, return specific property
    if (data) {
      return user[data];
    }

    // Otherwise, return the entire user object
    return user;
  },
);
