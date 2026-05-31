import { definePlaygroundFromKit } from 'dslinter';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';

export const alertPlayground = definePlaygroundFromKit({
    controls: {
        title: 'Alert',
        description:
            'Default alert for status messages and inline notices.',
    },
    kit: ({ title, description }) => (
        <Alert className="max-w-md">
            <AlertTitle>{title}</AlertTitle>
            <AlertDescription>{description}</AlertDescription>
        </Alert>
    ),
});
