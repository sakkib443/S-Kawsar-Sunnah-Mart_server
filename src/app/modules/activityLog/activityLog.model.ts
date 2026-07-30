import { Schema, model, Document, Types } from 'mongoose';

export interface IActivityLog extends Document {
    actor: Types.ObjectId | null;
    actorName: string;
    action: string;
    target: string;
    meta: unknown;
    createdAt: Date;
    updatedAt: Date;
}

const activityLogSchema = new Schema<IActivityLog>(
    {
        actor: { type: Schema.Types.ObjectId, ref: 'User', default: null, index: true },
        actorName: { type: String, default: '' },
        action: { type: String, required: true },
        target: { type: String, default: '' },
        meta: { type: Schema.Types.Mixed, default: {} },
    },
    { timestamps: true }
);

// Fast "newest activity" admin feed.
activityLogSchema.index({ createdAt: -1 });

export const ActivityLog = model<IActivityLog>('ActivityLog', activityLogSchema);
