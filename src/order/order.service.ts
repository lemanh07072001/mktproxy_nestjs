import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Order } from './entities/order.entity';

@Injectable()
export class OrderService {
  constructor(
    @InjectRepository(Order)
    private orderRepository: Repository<Order>,
  ) {}

  async findAll(): Promise<Order[]> {
    return this.orderRepository.find({
      relations: ['user', 'type_service', 'api_keys'],
    });
  }

  async findOne(id: number): Promise<Order | null> {
    return this.orderRepository.findOne({
      where: { id },
      relations: ['user', 'type_service', 'api_keys'],
    });
  }

  async findByUserId(userId: number): Promise<Order[]> {
    return this.orderRepository.find({
      where: { user_id: userId },
      relations: ['user', 'type_service', 'api_keys'],
    });
  }

  async findByOrderCode(orderCode: string): Promise<Order | null> {
    return this.orderRepository.findOne({
      where: { order_code: orderCode },
      relations: ['user', 'type_service', 'api_keys'],
    });
  }
}

