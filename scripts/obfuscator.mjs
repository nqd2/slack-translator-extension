import JavaScriptObfuscator from 'javascript-obfuscator';

export const OBFUSCATOR_OPTIONS = {
  compact: true,
  controlFlowFlattening: true,
  controlFlowFlatteningThreshold: 0.75,
  deadCodeInjection: false,
  debugProtection: false,
  selfDefending: true,
  stringArray: true,
  stringArrayEncoding: ['base64'],
  stringArrayThreshold: 0.8,
  stringArrayRotate: true,
  stringArrayShuffle: true,
  identifierNamesGenerator: 'hexadecimal',
  target: 'browser-no-eval',
  transformObjectKeys: true
};

/**
 * Obfuscate JavaScript code using Extreme Lock profile
 * @param {string} code
 * @returns {string} Obfuscated code
 */
export function obfuscateCode(code) {
  const result = JavaScriptObfuscator.obfuscate(code, OBFUSCATOR_OPTIONS);
  return result.getObfuscatedCode();
}
