import { GUARDS_METADATA } from '@nestjs/common/constants';
import { AdminGuard } from 'src/admin/admin.guard';
import { JwtAuthGuard } from 'src/auth/jwt-auth.guard';
import { RagController } from './rag.controller';

describe('RagController security', () => {
  function getGuardTypes(methodName: keyof RagController) {
    return Reflect.getMetadata(
      GUARDS_METADATA,
      RagController.prototype[methodName],
    ) as unknown[] | undefined;
  }

  it('requires admin authentication before indexing one review', () => {
    expect(getGuardTypes('indexOne')).toEqual([JwtAuthGuard, AdminGuard]);
  });

  it('requires admin authentication before reindexing all reviews', () => {
    expect(getGuardTypes('indexAll')).toEqual([JwtAuthGuard, AdminGuard]);
  });
});
