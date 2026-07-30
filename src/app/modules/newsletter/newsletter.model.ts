import { Schema, model, Document } from 'mongoose';

export interface INewsletterSubscriber extends Document {
    email: string;
    createdAt: Date;
    updatedAt: Date;
}

const newsletterSchema = new Schema<INewsletterSubscriber>(
    {
        email: {
            type: String,
            required: true,
            unique: true,
            lowercase: true,
            trim: true,
            index: true,
        },
    },
    { timestamps: true }
);

export const NewsletterSubscriber = model<INewsletterSubscriber>('NewsletterSubscriber', newsletterSchema);
