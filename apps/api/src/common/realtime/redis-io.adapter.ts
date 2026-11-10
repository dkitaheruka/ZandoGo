import { INestApplication } from '@nestjs/common';
import { IoAdapter } from '@nestjs/platform-socket.io';
import { createAdapter } from '@socket.io/redis-adapter';
import { createClient, RedisClientType } from 'redis';
import { ServerOptions } from 'socket.io';

export class RedisIoAdapter extends IoAdapter {
  private publisher: RedisClientType | undefined;
  private subscriber: RedisClientType | undefined;

  constructor(app: INestApplication) {
    super(app);
  }

  async connectToRedis(redisUrl: string): Promise<void> {
    if (this.publisher || this.subscriber) {
      throw new Error('Redis Socket.IO adapter is already connected');
    }

    const publisher = createClient({ url: redisUrl });
    const subscriber = publisher.duplicate();

    try {
      await Promise.all([publisher.connect(), subscriber.connect()]);
    } catch (error) {
      publisher.destroy();
      subscriber.destroy();
      throw error;
    }

    this.publisher = publisher;
    this.subscriber = subscriber;
  }

  createIOServer(port: number, options?: ServerOptions) {
    if (!this.publisher || !this.subscriber) {
      throw new Error('Redis Socket.IO adapter must be connected before creating a server');
    }

    const server = super.createIOServer(port, options);
    server.adapter(createAdapter(this.publisher, this.subscriber));
    return server;
  }

  async close(server: Parameters<IoAdapter['close']>[0]): Promise<void> {
    await super.close(server);
    await this.dispose();
  }

  async dispose(): Promise<void> {
    const clients = [this.publisher, this.subscriber].filter(
      (client): client is RedisClientType => client !== undefined,
    );
    await Promise.allSettled(clients.map((client) => client.quit()));
    this.publisher = undefined;
    this.subscriber = undefined;
  }
}
