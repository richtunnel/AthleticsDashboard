interface SlackWebhookParams {
  time: string;
  endpoint: string;
  customer: string;
  body: string;
  type: 'feedback' | 'ticket';
}

export class SlackService {
  private webhookUrl: string | undefined;

  constructor() {
    this.webhookUrl = process.env.SLACK_FEEDBACK_WEBHOOK_URL;
  }

  async sendFeedbackNotification(params: SlackWebhookParams): Promise<void> {
    if (!this.webhookUrl) {
      console.warn('SLACK_FEEDBACK_WEBHOOK_URL not configured. Skipping Slack notification.');
      return;
    }

    try {
      const emoji = params.type === 'feedback' ? ':speech_balloon:' : ':ticket:';
      const title = params.type === 'feedback' ? 'New Feedback Submission' : 'New Support Ticket';
      
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
              text: `*Message:*\n${params.body}`,
            },
          },
        ],
      };

      const response = await fetch(this.webhookUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(message),
      });

      if (!response.ok) {
        throw new Error(`Slack webhook failed with status ${response.status}`);
      }

      console.log('Slack notification sent successfully');
    } catch (error) {
      console.error('Failed to send Slack notification:', error);
      // Don't throw - this is a non-critical feature
    }
  }
}

export const slackService = new SlackService();
