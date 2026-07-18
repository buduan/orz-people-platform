import Ajv2020, { type Options } from 'ajv/dist/2020';
import addFormats from 'ajv-formats';
import { ORZ_LOCAL_TIME_FORMAT, isOrzLocalTime } from './formats/orz-local-time';

const DEFAULT_OPTIONS: Options = {
  allErrors: true,
  strict: true,
  validateFormats: true,
};

/** Creates the authoritative server-side Draft 2020-12 validator. */
export function createFormValidator(options: Options = {}): Ajv2020 {
  const validator = new Ajv2020({
    ...DEFAULT_OPTIONS,
    ...options,
  });

  addFormats(validator, ['date', 'date-time', 'email']);
  validator.addFormat(ORZ_LOCAL_TIME_FORMAT, {
    type: 'string',
    validate: isOrzLocalTime,
  });

  return validator;
}
