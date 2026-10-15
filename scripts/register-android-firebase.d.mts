export function registerAndroid(run: (args: string[]) => Promise<unknown>, certificate: { packageName: string; sha1: string; sha256: string }): Promise<string>;
