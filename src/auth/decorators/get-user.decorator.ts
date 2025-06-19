// src/auth/decorators/get-user.decorator.ts
// Kiểm tra và sửa decorator GetUser để đảm bảo nó trả về user đúng cách

import { createParamDecorator, ExecutionContext, Logger } from '@nestjs/common';

export const GetUser = createParamDecorator(
  (data: unknown, ctx: ExecutionContext) => {
    const logger = new Logger('GetUserDecorator');
    const request = ctx.switchToHttp().getRequest();

    // Thêm logging để debug
    logger.debug(`Request user: ${JSON.stringify(request.user)}`);

    if (!request.user) {
      logger.error('User object not found in request');
      return null;
    }

    // Nếu request.user đến từ JWT token, nó có thể có dạng khác với User entity
    // Kiểm tra và xây dựng đối tượng User phù hợp
    if (request.user.sub && !request.user.id) {
      logger.debug('Converting JWT payload to User object');
      return {
        id: request.user.sub,
        email: request.user.email,
        roles: request.user.roles || [],
      };
    }

    return request.user;
  },
);
