import { Global, Module } from '@nestjs/common';
import {
  AbstractStorageService,
  LocalStorageService,
} from './storage.service';

@Global()
@Module({
  providers: [
    LocalStorageService,
    {
      provide: AbstractStorageService,
      useExisting: LocalStorageService,
    },
  ],
  exports: [AbstractStorageService, LocalStorageService],
})
export class StorageModule {}
