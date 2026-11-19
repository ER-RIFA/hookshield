import { Delivery, IDelivery } from '../models/Delivery';
import { DeliveryAttempt } from '../models/DeliveryAttempt';
import { AppError } from '../middleware/errorHandler';
import mongoose from 'mongoose';

export async function listDeliveries(
  ownerId: string,
  filters: { status?: string; endpointId?: string; eventId?: string } = {},
  page = 1,
  limit = 20
): Promise<{ data: IDelivery[]; total: number; page: number; pages: number }> {
  const query: Record<string, unknown> = { ownerId };
  if (filters.status) query.status = filters.status;
  if (filters.endpointId) query.endpointId = new mongoose.Types.ObjectId(filters.endpointId);
  if (filters.eventId) query.eventId = new mongoose.Types.ObjectId(filters.eventId);

  const skip = (page - 1) * limit;
  const [data, total] = await Promise.all([
    Delivery.find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .populate('eventId', 'eventId type createdAt')
      .populate('endpointId', 'url description'),
    Delivery.countDocuments(query),
  ]);
  return { data, total, page, pages: Math.ceil(total / limit) };
}

export async function getDeliveryDetails(id: string, ownerId: string) {
  const delivery = await Delivery.findOne({ _id: id, ownerId })
    .populate('eventId', 'eventId type payload createdAt')
    .populate('endpointId', 'url description');
  if (!delivery) throw new AppError(404, 'Delivery not found');

  const attempts = await DeliveryAttempt.find({ deliveryId: delivery._id }).sort({ attemptNo: 1 });
  return { delivery, attempts };
}

export async function replayDelivery(id: string, ownerId: string): Promise<IDelivery> {
  const delivery = await Delivery.findOne({ _id: id, ownerId });
  if (!delivery) throw new AppError(404, 'Delivery not found');
  if (delivery.status === 'pending' || delivery.status === 'delivering') {
    throw new AppError(409, 'Delivery is already in progress');
  }

  delivery.status = 'pending';
  delivery.attempts = 0;
  delivery.nextAttemptAt = new Date();
  delivery.leaseUntil = undefined;
  delivery.lastError = undefined;
  await delivery.save();
  return delivery;
}

export async function replayAllFailed(ownerId: string): Promise<{ replayedCount: number }> {
  const result = await Delivery.updateMany(
    { ownerId, status: 'failed' },
    {
      $set: {
        status: 'pending',
        attempts: 0,
        nextAttemptAt: new Date(),
      },
      $unset: {
        leaseUntil: 1,
        lastError: 1,
      },
    }
  );
  return { replayedCount: result.modifiedCount };
}

export async function getDashboardStats(ownerId: string) {
  const [pending, delivering, retrying, success, failed] = await Promise.all([
    Delivery.countDocuments({ ownerId, status: 'pending' }),
    Delivery.countDocuments({ ownerId, status: 'delivering' }),
    Delivery.countDocuments({ ownerId, status: 'retrying' }),
    Delivery.countDocuments({ ownerId, status: 'success' }),
    Delivery.countDocuments({ ownerId, status: 'failed' }),
  ]);
  return { pending, delivering, retrying, success, failed, total: pending + delivering + retrying + success + failed };
}
