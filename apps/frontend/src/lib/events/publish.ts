// apps/frontend/src/lib/events/publish.ts
import { PubSub } from '@google-cloud/pubsub';
import { Logger } from '@/lib/core/Logger';

const logger = new Logger('EVENT-PUBLISHER');
const pubsub = new PubSub();

// Environment variable for the topic name, e.g., 'domain-events'
const topicName = process.env.PUBSUB_TOPIC_NAME || 'default-topic';

/**
 * Publishes a domain event to the Google Cloud Pub/Sub topic.
 *
 * @param eventType - The type of the event (e.g., 'UserCheckedIn').
 * @param payload - The data associated with the event.
 */
export async function publishEvent(eventType: string, payload: object) {
  try {
    const dataBuffer = Buffer.from(JSON.stringify(payload));
    const messageId = await pubsub.topic(topicName).publishMessage({
      data: dataBuffer,
      attributes: {
        eventType,
      },
    });
    logger.info(`Event '${eventType}' published with message ID: ${messageId}`);
    return messageId;
  } catch (error) {
    logger.error(`Failed to publish event '${eventType}':`, error);
    // In a real-world scenario, you might want to add this to a retry queue.
    throw new Error(`Failed to publish event: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}
