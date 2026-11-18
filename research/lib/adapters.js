// Source adapters. Only the documented file format (CSV/JSON, see research/docs/data-dictionary.md) is implemented.
// Vendor adapters are STUBS: no vendor API or SDK is invented. They refuse to import and list the exact questions a
// real integration needs answered (research/docs/supplier-checklist.md).
import { preview } from './ingest.js';

export class FileAdapter {
  id = 'documented-file-format-v1'; displayName = 'Documented CSV/JSON file'; verified = true; // verified against its own specification only
  capabilities() { return { skin_temperature: 'as_declared_per_row', basal_body_temperature: 'as_declared_per_row', ambient_temperature: 'as_declared_per_row', qualityFlags: 'source_declared_only' }; }
  preview(text, opts) { return preview(text, opts); }
}

export const VENDOR_QUESTIONS = [
  'Is per-sample (timestamped) skin temperature available, or only a vendor-derived nightly value? If derived, what is the exact method and window?',
  'What is the sampling interval during sleep, and does sampling continue all night or only in detected sleep?',
  'Are timestamps UTC epoch with the device UTC offset at recording time? How does the clock drift, and what happens offline?',
  'Units, resolution and stated sensor accuracy; sensor site (wrist, finger, other) and contact method.',
  'Which quality signals exist (off-wrist, contact, motion, error codes), and how are they defined?',
  'Are device ID, model and firmware reported on every record, and are firmware changes signalled?',
  'Is there a stable sample identifier or sequence number for de-duplication and retransmission?',
  'How far back can data be fetched, and how long is it stored on the device and in any vendor cloud?',
  'Does access require uploading data to a vendor cloud? If so, under what data-processing terms, location and retention?',
  'Do licence terms allow research use of health data, export, and deletion on request? Who owns the data?',
  'Which platform route is supported (Web Bluetooth GATT profile, native SDK, server API) and is there a sandbox with test data?',
  'Has the vendor validated the measurement against a reference? Under what conditions, with what results and population?',
];

class VendorStub {
  verified = false;
  constructor(id, displayName) { this.id = id; this.displayName = displayName; }
  capabilities() { return { skin_temperature: false, basal_body_temperature: false, ambient_temperature: false, qualityFlags: false }; }
  get status() { return 'Not integrated. No SDK, API documentation or test data is available, so nothing about this device is claimed to work.'; }
  preview() { throw Object.assign(new Error('adapter_not_implemented'), { code: 'adapter_not_implemented', questions: VENDOR_QUESTIONS }); }
}
export const SwlDs07Adapter = () => new VendorStub('swl-ds07-stub', 'SWL DS07 (stub)');
export const GenericVendorAdapter = name => new VendorStub(`vendor-stub-${String(name).toLowerCase().replace(/[^a-z0-9]+/g, '-')}`, `${name} (stub)`);
