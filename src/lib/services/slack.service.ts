interface SlackWebhookParams {
  time: string;
  endpoint: string;
  customer: string;
  body: string;
  type: 'feedback' | 'ticket' | 'signup' | 'email_subscription';
}

export class SlackService {
  private signupsWebhookUrl: string | undefined;
  private feedbackWebhookUrl: string | undefined;
  private supportWebhookUrl: string | undefined;
  private emailSubscriptionsWebhookUrl: string | undefined;

  constructor() {
    this.signupsWebhookUrl = process.env.SLACK_SIGNUPS_WEBHOOK_URL;
    this.feedbackWebhookUrl = process.env.SLACK_FEEDBACK_WEBHOOK_URL;
    this.supportWebhookUrl = process.env.SLACK_SUPPORT_WEBHOOK_URL;
    this.emailSubscriptionsWebhookUrl = process.env.SLACK_EMAIL_SUBSCRIPTIONS_WEBHOOK_URL;
  }

  private getWebhookUrl(type: SlackWebhookParams['type']): string | undefined {
    switch (type) {
      case 'signup':
        return this.signupsWebhookUrl;
      case 'feedback':
        return this.feedbackWebhookUrl;
      case 'ticket':
        return this.supportWebhookUrl;
      case 'email_subscription':
        return this.emailSubscriptionsWebhookUrl;
      default:
        return undefined;
    }
  }

  private truncateText(text: string, maxLength: number = 150): string {
    if (text.length <= maxLength) {
      return text;
    }
    return text.substring(0, maxLength - 3) + '...';
  }

  private getEmojiAndTitle(type: SlackWebhookParams['type']): { emoji: string; title: string } {
    switch (type) {
      case 'signup':
        return { emoji: ':tada:', title: 'New User Signup' };
      case 'feedback':
        return { emoji: ':speech_balloon:', title: 'New Feedback Submission' };
      case 'ticket':
        return { emoji: ':ticket:', title: 'New Support Ticket' };
      case 'email_subscription':
        return { emoji: ':mailbox:', title: 'New Email Subscription' };
    }
  }

  async sendSlackNotification(params: SlackWebhookParams): Promise<void> {
    const webhookUrl = this.getWebhookUrl(params.type);

    if (!webhookUrl) {
      console.warn(`SLACK webhook for ${params.type} not configured. Skipping Slack notification.`);
      return;
    }

    try {
      const { emoji, title } = this.getEmojiAndTitle(params.type);
      const truncatedBody = this.truncateText(params.body);

      const message = {
        text: `${emoji} ${title}`,
        blocks: [
          {
            type: 'header',
            text: {
              type: 'plain_text',
              text: `${emoji} ${title}`,
              emoji: true,
            },
          },
          {
            type: 'section',
            fields: [
              {
                type: 'mrkdwn',
                text: `*Time:*\n${params.time}`,
              },
              {
                type: 'mrkdwn',
                text: `*Endpoint:*\n${params.endpoint}`,
              },
              {
                type: 'mrkdwn',
                text: `*Customer:*\n${params.customer}`,
              },
            ],
          },
          {
            type: 'section',
            text: {
              type: 'mrkdwn',
              text: `*Message:*\n${truncatedBody}`,
            },
          },
        ],
      };

      const response = await fetch(webhookUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(message),
      });

      if (!response.ok) {
        throw new Error(`Slack webhook failed with status ${response.status}`);
      }

      console.log(`Slack notification sent successfully for ${params.type}`);
    } catch (error) {
      console.error('Failed to send Slack notification:', error);
      // Don't throw - this is a non-critical feature
    }
  }

  // Convenience methods for backward compatibility and ease of use
  async sendFeedbackNotification(params: Omit<SlackWebhookParams, 'type'>): Promise<void> {
    return this.sendSlackNotification({ ...params, type: 'feedback' });
  }

  async sendSupportTicketNotification(params: Omit<SlackWebhookParams, 'type'>): Promise<void> {
    return this.sendSlackNotification({ ...params, type: 'ticket' });
  }

  async sendSignupNotification(params: Omit<SlackWebhookParams, 'type'>): Promise<void> {
    return this.sendSlackNotification({ ...params, type: 'signup' });
  }

  async sendEmailSubscriptionNotification(params: Omit<SlackWebhookParams, 'type'>): Promise<void> {
    return this.sendSlackNotification({ ...params, type: 'email_subscription' });
  }
}

export const slackService = new SlackService();
