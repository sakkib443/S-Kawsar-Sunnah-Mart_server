import { Schema, model, Document, Types } from 'mongoose';

export interface INotification extends Document {
    user: Types.ObjectId;
    type: string;
    title: string;
    message: string;
    link: string;
    isRead: boolean;
    meta: unknown;
    createdAt: Date;
    updatedAt: Date;
}

const notificationSchema = new Schema<INotification>(
    {
        user: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
        type: { type: String, required: true },
        title: { type: String, required: true },
        message: { type: String, required: true },
        link: { type: String, default: '' },
        isRead: { type: Boolean, default: false },
        meta: { type: Schema.Types.Mixed, default: {} },
    },
    { timestamps: true }
);

// Fast "my newest unread/read notifications" queries.
notificationSchema.index({ user: 1, createdAt: -1 });
notificationSchema.index({ user: 1, isRead: 1 });

export const Notification = model<INotification>('Notification', notificationSchema);
