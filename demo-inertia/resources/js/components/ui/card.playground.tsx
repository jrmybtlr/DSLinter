import { definePlayground } from 'dslinter';
import {
    Card,
    CardContent,
    CardDescription,
    CardFooter,
    CardHeader,
    CardTitle,
} from '@/components/ui/card';

export const cardPlayground = definePlayground({
    render: () => (
        <Card className="w-[320px]">
            <CardHeader>
                <CardTitle>Card</CardTitle>
                <CardDescription>
                    Header, content, and footer regions.
                </CardDescription>
            </CardHeader>
            <CardContent>
                <p className="text-sm">Card body content.</p>
            </CardContent>
            <CardFooter className="text-muted-foreground text-sm">
                Card footer
            </CardFooter>
        </Card>
    ),
});
