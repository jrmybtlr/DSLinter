import { definePlayground } from 'dslinter';
import { Button } from '@/components/ui/button';
import {
    Dialog,
    DialogClose,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from '@/components/ui/dialog';

export const dialogPlayground = definePlayground(({ triggerLabel, title, description }) => (
    <Dialog>
        <DialogTrigger asChild>
            <Button variant="outline">{triggerLabel}</Button>
        </DialogTrigger>
        <DialogContent>
            <DialogHeader>
                <DialogTitle>{title}</DialogTitle>
                <DialogDescription>{description}</DialogDescription>
            </DialogHeader>
            <DialogFooter>
                <DialogClose asChild>
                    <Button variant="outline">Cancel</Button>
                </DialogClose>
                <Button>Continue</Button>
            </DialogFooter>
        </DialogContent>
    </Dialog>
));
