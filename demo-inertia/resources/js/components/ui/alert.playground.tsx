import { definePlaygroundFromKit } from 'dslinter';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';

export const alertPlayground = definePlaygroundFromKit({
    controls: ['title', 'description'],
    kit: ({ title, description }) => (
        <Alert className="max-w-md">
            <AlertTitle>{title}</AlertTitle>
            <AlertDescription>{description}</AlertDescription>
        </Alert>
    ),
});
