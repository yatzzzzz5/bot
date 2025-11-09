import { logger } from '../../utils/logger';

export interface AlertMessage {
  level: 'INFO' | 'WARN' | 'ERROR';
  type: string;
  message: string;
}

export class AlertDispatcher {
  private telegramToken?: string;
  private telegramChatId?: string;
  private discordWebhookUrl?: string;

  configure(opts: { telegramToken?: string; telegramChatId?: string; discordWebhookUrl?: string; }) {
    this.telegramToken = opts.telegramToken;
    this.telegramChatId = opts.telegramChatId;
    this.discordWebhookUrl = opts.discordWebhookUrl;
  }

  async dispatch(alert: AlertMessage): Promise<void> {
    try {
      logger.warn(`[ALERT] [${alert.level}] ${alert.type}: ${alert.message}`);
      const text = `[$${'{'+`ALERT ${alert.level}`+'}'}] ${alert.type}: ${alert.message}`;
      await Promise.all([
        this.sendTelegram(text),
        this.sendDiscord(text)
      ]);
    } catch (e) {
      logger.error('Alert dispatch error:', e);
    }
  }

  private async sendTelegram(text: string): Promise<void> {
    if (!this.telegramToken || !this.telegramChatId) return;
    try {
      const url = `https://api.telegram.org/bot${this.telegramToken}/sendMessage`;
      const body = { chat_id: this.telegramChatId, text };
      await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });
    } catch (e) {
      logger.error('Telegram send error:', e);
    }
  }

  private async sendDiscord(text: string): Promise<void> {
    if (!this.discordWebhookUrl) return;
    try {
      await fetch(this.discordWebhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: text })
      });
    } catch (e) {
      logger.error('Discord send error:', e);
    }
  }
}


