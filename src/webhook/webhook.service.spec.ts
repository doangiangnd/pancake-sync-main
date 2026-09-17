import axios from 'axios';
import { WebhookService } from './webhook.service';

jest.mock('axios');

describe('WebhookService pending referral delivery', () => {
  const mockedAxios = axios as jest.Mocked<typeof axios>;
  const originalEnv = { ...process.env };

  beforeEach(() => {
    process.env.VCC_LARAVEL_API_BASE_URL = 'https://crm.vccdev.vn/api';
    process.env.VCC_LARAVEL_WEBHOOK_SECRET = 'vcc-secret';
    process.env.MINTOKU_LARAVEL_API_BASE_URL = 'https://crm.mintoku.vn/api';
    process.env.MINTOKU_LARAVEL_WEBHOOK_SECRET = 'mintoku-secret';
    delete process.env.LARAVEL_API_BASE_URL;
    delete process.env.LARAVEL_WEBHOOK_SECRET;
    mockedAxios.post.mockResolvedValue({ data: { success: true } } as any);
    mockedAxios.delete.mockResolvedValue({ data: { success: true } } as any);
  });

  afterEach(() => {
    process.env = { ...originalEnv };
    jest.restoreAllMocks();
  });

  it('stores a captured ref in every configured Laravel CRM', async () => {
    const service = new WebhookService();
    jest.spyOn(service as any, 'loadLocalPendingRefs').mockReturnValue({});
    jest.spyOn(service as any, 'saveLocalPendingRefs').mockImplementation();

    await service.setPendingRef('331141913426390_customer-1', {
      ref: 'xxxxx',
      page_id: '331141913426390',
      sender_id: 'customer-1',
      captured_at: '2026-07-16T00:00:00.000Z',
    });

    expect(mockedAxios.post).toHaveBeenCalledTimes(2);
    expect(mockedAxios.post).toHaveBeenCalledWith(
      'https://crm.vccdev.vn/api/internal/pancake/pending-refs',
      expect.objectContaining({ ref: 'xxxxx' }),
      expect.objectContaining({
        headers: expect.objectContaining({
          'X-Webhook-Secret': 'vcc-secret',
        }),
      }),
    );
    expect(mockedAxios.post).toHaveBeenCalledWith(
      'https://crm.mintoku.vn/api/internal/pancake/pending-refs',
      expect.objectContaining({ ref: 'xxxxx' }),
      expect.objectContaining({
        headers: expect.objectContaining({
          'X-Webhook-Secret': 'mintoku-secret',
        }),
      }),
    );
  });

  it('keeps the ref available after Pancake CRM succeeds', async () => {
    const service = new WebhookService();
    jest.spyOn(service, 'setPendingRef').mockResolvedValue(undefined);
    jest.spyOn(service, 'syncRefToPancake').mockResolvedValue(true);
    const removeSpy = jest.spyOn(service, 'removePendingRef');

    await service.handleRefCapture('331141913426390', 'customer-1', 'xxxxx');

    expect(removeSpy).not.toHaveBeenCalled();
  });

  it('uses the local pending ref when Laravel is unavailable', async () => {
    const service = new WebhookService();
    jest.spyOn(service as any, 'loadLocalPendingRefs').mockReturnValue({
      page_customer: { ref: 'local-ref' },
    });

    await expect(service.getPendingRef('page_customer')).resolves.toEqual({
      ref: 'local-ref',
    });
    expect(mockedAxios.get).not.toHaveBeenCalled();
  });

  it('captures a ref included in a Pancake messaging webhook', async () => {
    const service = new WebhookService();
    jest.spyOn(service, 'logLine').mockImplementation();
    const capture = jest
      .spyOn(service, 'handleRefCapture')
      .mockResolvedValue(undefined);

    await service.processPancakeMessagingReferral({
      event_type: 'messaging',
      page_id: 'page-1',
      data: {
        conversation: { id: 'page-1_customer-1' },
        message: {
          from: { id: 'customer-1' },
          referral: { ref: 'messenger-campaign' },
        },
      },
    });

    expect(capture).toHaveBeenCalledWith(
      'page-1',
      'customer-1',
      'messenger-campaign',
    );
  });

  it('does not write the same ref back to Pancake repeatedly', async () => {
    const service = new WebhookService();
    jest.spyOn(service, 'setLeadIndex').mockImplementation();
    jest.spyOn(service, 'loadPendingRefs').mockResolvedValue({
      page_customer: { ref: 'same-ref' },
    });
    const sync = jest
      .spyOn(service, 'syncRefToPancake')
      .mockResolvedValue(true);
    jest.spyOn(service, 'logLine').mockImplementation();

    await (service as any).applyPendingRefToPancakeRecord({
      id: 'record-1',
      workspace_id: 607,
      table_id: 'lead',
      conversation_id: 'page_customer',
      ref: 'same-ref',
    });

    expect(sync).not.toHaveBeenCalled();
  });

  it('renders captured Messenger refs as the primary dashboard status', () => {
    const service = new WebhookService();
    jest
      .spyOn(service, 'getLogTail')
      .mockReturnValue([
        '[2026-09-17 08:30:00][IMPORTANT] Meta ref captured {"conversation_id":"page_customer","event_type":"referral","ref":"fb-ad-123"}',
        '[2026-09-17 08:30:01][ERROR] Example failure {"message":"timeout"}',
      ]);

    const html = service.renderLogViewer(200);

    expect(html).toContain('Đã lấy được ref từ Messenger');
    expect(html).toContain('fb-ad-123');
    expect(html).toContain('page_customer');
    expect(html).toContain('data-category="captured"');
    expect(html).toContain('data-category="error"');
  });

  it('streams new log lines to connected web clients', () => {
    const service = new WebhookService();
    const response: any = {
      setHeader: jest.fn(),
      flushHeaders: jest.fn(),
      write: jest.fn(),
    };

    const clientId = service.addLogStreamClient(response);
    (service as any).broadcastLogLine('Meta ref captured');
    service.removeLogStreamClient(clientId);

    expect(response.setHeader).toHaveBeenCalledWith(
      'Content-Type',
      'text/event-stream; charset=utf-8',
    );
    expect(response.write).toHaveBeenCalledWith(
      expect.stringContaining('event: log'),
    );
  });
});
