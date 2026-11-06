export const EASYBOT_MESSAGE_SENDER = Symbol('EASYBOT_MESSAGE_SENDER');

export interface EasyBotMessageSender {
  sendMessageForAi(
    companyId: string,
    contactId: string,
    content: string,
  ): Promise<unknown>;
}
