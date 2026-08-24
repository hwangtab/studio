import { getSubmitStatusRule, isContactField, parseContactResponseBody } from './contactSubmitPolicy';

describe('isContactField', () => {
  it('accepts only fields that are editable in the contact form', () => {
    expect(isContactField('name')).toBe(true);
    expect(isContactField('email')).toBe(true);
    expect(isContactField('phone')).toBe(true);
    expect(isContactField('message')).toBe(true);
    expect(isContactField('company')).toBe(false);
    expect(isContactField('')).toBe(false);
  });
});

describe('getSubmitStatusRule', () => {
  it('maps expected HTTP statuses to localized message keys and retry policy', () => {
    expect(getSubmitStatusRule(429)).toEqual({ messageKey: 'tooMany', canRetry: true });
    expect(getSubmitStatusRule(403)).toEqual({ messageKey: 'forbidden', canRetry: false });
    expect(getSubmitStatusRule(504)).toEqual({ messageKey: 'timeout', canRetry: true });
    expect(getSubmitStatusRule(418)).toBeUndefined();
  });
});

describe('parseContactResponseBody', () => {
  it('returns an empty body when the response is not valid JSON', async () => {
    const body = await parseContactResponseBody({
      json: async () => {
        throw new Error('invalid json');
      },
    } as unknown as Response);

    expect(body).toEqual({});
  });

  it('logs the parse failure instead of swallowing it silently', async () => {
    const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    const parseError = new Error('Unexpected token < in JSON');

    await parseContactResponseBody({
      json: async () => {
        throw parseError;
      },
    } as unknown as Response);

    expect(consoleErrorSpy).toHaveBeenCalledWith(
      expect.stringContaining('[contactSubmitPolicy]'),
      parseError
    );

    consoleErrorSpy.mockRestore();
  });
});
