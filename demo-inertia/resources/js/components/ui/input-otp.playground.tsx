import { definePlayground } from 'dslinter';
import { inputOtpPreview } from '@/playground/preview-kits';

export const inputOtpPlayground = definePlayground({
    id: 'InputOTP',
    group: 'ui',
    render: () => inputOtpPreview(),
});
