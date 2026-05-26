import { MoreHorizontal } from 'lucide-react';
import type { ReactNode } from 'react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
    Breadcrumb,
    BreadcrumbItem,
    BreadcrumbLink,
    BreadcrumbList,
    BreadcrumbPage,
    BreadcrumbSeparator,
} from '@/components/ui/breadcrumb';
import { Button } from '@/components/ui/button';
import {
    Card,
    CardContent,
    CardDescription,
    CardFooter,
    CardHeader,
    CardTitle,
} from '@/components/ui/card';
import {
    Collapsible,
    CollapsibleContent,
    CollapsibleTrigger,
} from '@/components/ui/collapsible';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from '@/components/ui/dialog';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
    InputOTP,
    InputOTPGroup,
    InputOTPSlot,
} from '@/components/ui/input-otp';
import {
    NavigationMenu,
    NavigationMenuItem,
    NavigationMenuLink,
    NavigationMenuList,
} from '@/components/ui/navigation-menu';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import {
    Sheet,
    SheetContent,
    SheetDescription,
    SheetHeader,
    SheetTitle,
    SheetTrigger,
} from '@/components/ui/sheet';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import {
    Tooltip,
    TooltipContent,
    TooltipTrigger,
} from '@/components/ui/tooltip';

export type MenuPreviewItem = {
    label: string;
};

export type MenuPreviewOptions = {
    triggerLabel?: string;
    items?: MenuPreviewItem[];
    align?: 'start' | 'center' | 'end';
};

export function menuPreview({
    triggerLabel = 'Open menu',
    items = [
        { label: 'Profile' },
        { label: 'Settings' },
        { label: 'Sign out' },
    ],
    align = 'end',
}: MenuPreviewOptions = {}): ReactNode {
    return (
        <DropdownMenu>
            <DropdownMenuTrigger asChild>
                <Button variant="outline" size="icon">
                    <MoreHorizontal />
                    <span className="sr-only">{triggerLabel}</span>
                </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align={align}>
                {items.map((item) => (
                    <DropdownMenuItem key={item.label}>
                        {item.label}
                    </DropdownMenuItem>
                ))}
            </DropdownMenuContent>
        </DropdownMenu>
    );
}

export type DialogPreviewOptions = {
    triggerLabel?: string;
    title?: string;
    description?: string;
    confirmLabel?: string;
    cancelLabel?: string;
};

export function dialogPreview({
    triggerLabel = 'Open dialog',
    title = 'Dialog',
    description = 'Modal content built with Radix Dialog primitives.',
    confirmLabel = 'Continue',
    cancelLabel = 'Cancel',
}: DialogPreviewOptions = {}): ReactNode {
    return (
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
                    <Button variant="outline">{cancelLabel}</Button>
                    <Button>{confirmLabel}</Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}

export type SelectPreviewOptions = {
    placeholder?: string;
    defaultValue?: string;
    options?: { value: string; label: string }[];
};

export function selectPreview({
    placeholder = 'Pick a stack',
    defaultValue = 'react',
    options = [
        { value: 'react', label: 'React' },
        { value: 'vue', label: 'Vue' },
        { value: 'svelte', label: 'Svelte' },
    ],
}: SelectPreviewOptions = {}): ReactNode {
    return (
        <Select defaultValue={defaultValue}>
            <SelectTrigger className="w-[220px]">
                <SelectValue placeholder={placeholder} />
            </SelectTrigger>
            <SelectContent>
                {options.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                        {option.label}
                    </SelectItem>
                ))}
            </SelectContent>
        </Select>
    );
}

export type TooltipPreviewOptions = {
    triggerLabel?: string;
    content?: string;
};

export function tooltipPreview({
    triggerLabel = 'Tooltip',
    content = 'Helpful hint on hover',
}: TooltipPreviewOptions = {}): ReactNode {
    return (
        <Tooltip>
            <TooltipTrigger asChild>
                <Button variant="ghost">{triggerLabel}</Button>
            </TooltipTrigger>
            <TooltipContent>
                <p>{content}</p>
            </TooltipContent>
        </Tooltip>
    );
}

export type SheetPreviewOptions = {
    triggerLabel?: string;
    title?: string;
    description?: string;
};

export function sheetPreview({
    triggerLabel = 'Open sheet',
    title = 'Sheet',
    description = 'Side panel built with Radix Sheet primitives.',
}: SheetPreviewOptions = {}): ReactNode {
    return (
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
    );
}

export type CollapsiblePreviewOptions = {
    triggerLabel?: string;
    content?: string;
};

export function collapsiblePreview({
    triggerLabel = 'Toggle details',
    content = 'Collapsible content revealed when expanded.',
}: CollapsiblePreviewOptions = {}): ReactNode {
    return (
        <Collapsible className="w-[260px] space-y-2">
            <CollapsibleTrigger asChild>
                <Button variant="outline" size="sm">
                    {triggerLabel}
                </Button>
            </CollapsibleTrigger>
            <CollapsibleContent className="text-muted-foreground text-sm">
                {content}
            </CollapsibleContent>
        </Collapsible>
    );
}

export function cardPreview(): ReactNode {
    return (
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
    );
}

export type AlertPreviewOptions = {
    title?: string;
    description?: string;
};

export function alertPreview({
    title = 'Alert',
    description = 'Default alert for status messages and inline notices.',
}: AlertPreviewOptions = {}): ReactNode {
    return (
        <Alert className="max-w-md">
            <AlertTitle>{title}</AlertTitle>
            <AlertDescription>{description}</AlertDescription>
        </Alert>
    );
}

export function avatarPreview(): ReactNode {
    return (
        <Avatar>
            <AvatarImage src="https://github.com/shadcn.png" alt="shadcn" />
            <AvatarFallback>SC</AvatarFallback>
        </Avatar>
    );
}

export function breadcrumbPreview(): ReactNode {
    return (
        <Breadcrumb>
            <BreadcrumbList>
                <BreadcrumbItem>
                    <BreadcrumbLink href="#">Home</BreadcrumbLink>
                </BreadcrumbItem>
                <BreadcrumbSeparator />
                <BreadcrumbItem>
                    <BreadcrumbLink href="#">Components</BreadcrumbLink>
                </BreadcrumbItem>
                <BreadcrumbSeparator />
                <BreadcrumbItem>
                    <BreadcrumbPage>Breadcrumb</BreadcrumbPage>
                </BreadcrumbItem>
            </BreadcrumbList>
        </Breadcrumb>
    );
}

export function navigationMenuPreview(): ReactNode {
    return (
        <NavigationMenu>
            <NavigationMenuList>
                <NavigationMenuItem>
                    <NavigationMenuLink href="#">Home</NavigationMenuLink>
                </NavigationMenuItem>
                <NavigationMenuItem>
                    <NavigationMenuLink href="#">Docs</NavigationMenuLink>
                </NavigationMenuItem>
                <NavigationMenuItem>
                    <NavigationMenuLink href="#">About</NavigationMenuLink>
                </NavigationMenuItem>
            </NavigationMenuList>
        </NavigationMenu>
    );
}

export function inputOtpPreview(): ReactNode {
    return (
        <InputOTP maxLength={6} defaultValue="123456">
            <InputOTPGroup>
                <InputOTPSlot index={0} />
                <InputOTPSlot index={1} />
                <InputOTPSlot index={2} />
                <InputOTPSlot index={3} />
                <InputOTPSlot index={4} />
                <InputOTPSlot index={5} />
            </InputOTPGroup>
        </InputOTP>
    );
}

export function toggleGroupPreview(): ReactNode {
    return (
        <ToggleGroup type="single" defaultValue="left">
            <ToggleGroupItem value="left" aria-label="Align left">
                Left
            </ToggleGroupItem>
            <ToggleGroupItem value="center" aria-label="Align center">
                Center
            </ToggleGroupItem>
            <ToggleGroupItem value="right" aria-label="Align right">
                Right
            </ToggleGroupItem>
        </ToggleGroup>
    );
}

export function sidebarPreview(): ReactNode {
    return (
        <div className="bg-sidebar text-sidebar-foreground w-[240px] rounded-lg border p-4">
            <p className="mb-2 text-sm font-medium">Sidebar preview</p>
            <p className="text-muted-foreground text-xs">
                Full sidebar layout requires SidebarProvider in the app shell.
                This stub shows sidebar tokens and spacing.
            </p>
        </div>
    );
}
