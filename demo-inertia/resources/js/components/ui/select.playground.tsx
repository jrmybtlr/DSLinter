import { definePlayground } from 'dslinter';
import { selectPreview } from '@/playground/preview-kits';

export const selectPlayground = definePlayground({
    id: 'Select',
    group: 'ui',
    controls: [
        {
            key: 'placeholder',
            label: 'Placeholder',
            type: 'string',
            default: 'Pick a stack',
        },
    ],
    render: (values) =>
        selectPreview({
            placeholder: String(values.placeholder ?? 'Pick a stack'),
        }),
});
