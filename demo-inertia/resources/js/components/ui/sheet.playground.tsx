import { definePlaygroundFromKit } from 'dslinter';
import { Button } from '@/components/ui/button';
import {
    Sheet,
    SheetContent,
    SheetDescription,
    SheetHeader,
    SheetTitle,
    SheetTrigger,
} from '@/components/ui/sheet';

export const sheetPlayground = definePlaygroundFromKit({
    controls: ['triggerLabel', 'title', 'description'],
    kit: ({ triggerLabel, title, description }) => (
        <Sheet>
            <SheetTrigger asChild>
                <Button variant="outline">{triggerLabel}</Button>
            </SheetTrigger>
            <SheetContent>
                <SheetHeader>
                    <SheetTitle>{title}</SheetTitle>
                    <SheetDescription>{description}</SheetDescription>
                </SheetHeader>
            </SheetContent>
        </Sheet>
    ),
});
