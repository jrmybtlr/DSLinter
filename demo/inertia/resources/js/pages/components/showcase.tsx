import { Head } from '@inertiajs/react';
import { AlertCircle, MoreHorizontal } from 'lucide-react';
import { useState } from 'react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
    Card,
    CardContent,
    CardDescription,
    CardFooter,
    CardHeader,
    CardTitle,
} from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
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
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { Skeleton } from '@/components/ui/skeleton';
import { Toggle } from '@/components/ui/toggle';
import {
    Tooltip,
    TooltipContent,
    TooltipTrigger,
} from '@/components/ui/tooltip';

export default function ComponentsShowcase() {
    const [dialogOpen, setDialogOpen] = useState(false);
    const [termsAccepted, setTermsAccepted] = useState(false);
    const [notifications, setNotifications] = useState(false);

    return (
        <>
            <Head title="Components" />
            <div className="flex flex-1 flex-col gap-6 overflow-x-auto p-4">
                <div>
                    <h1 className="text-2xl font-semibold tracking-tight">
                        shadcn/ui showcase
                    </h1>
                    <p className="text-muted-foreground text-sm">
                        Fifteen common components from the Laravel React starter
                        kit, all implemented as TypeScript TSX under{' '}
                        <code className="text-xs">
                            resources/js/components/ui/
                        </code>
                        .
                    </p>
                </div>

                <Alert>
                    <AlertCircle />
                    <AlertTitle>Alert</AlertTitle>
                    <AlertDescription>
                        Default alert for status messages and inline notices.
                    </AlertDescription>
                </Alert>

                <div className="grid gap-6 lg:grid-cols-2">
                    <Card>
                        <CardHeader>
                            <CardTitle>Card</CardTitle>
                            <CardDescription>
                                Button, badge, avatar, and input examples.
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="flex flex-col gap-4">
                            <div className="flex flex-wrap items-center gap-2">
                                <Button>Button</Button>
                                <Button variant="outline">Outline</Button>
                                <Button variant="secondary">Secondary</Button>
                                <Badge>Badge</Badge>
                                <Badge variant="secondary">Secondary</Badge>
                            </div>
                            <div className="flex items-center gap-3">
                                <Avatar>
                                    <AvatarImage
                                        src="https://github.com/shadcn.png"
                                        alt="shadcn"
                                    />
                                    <AvatarFallback>SC</AvatarFallback>
                                </Avatar>
                                <div className="grid flex-1 gap-2">
                                    <Label htmlFor="showcase-email">Label</Label>
                                    <Input
                                        id="showcase-email"
                                        type="email"
                                        placeholder="name@example.com"
                                    />
                                </div>
                            </div>
                        </CardContent>
                        <CardFooter className="text-muted-foreground text-sm">
                            Card footer
                        </CardFooter>
                    </Card>

                    <Card>
                        <CardHeader>
                            <CardTitle>Form controls</CardTitle>
                            <CardDescription>
                                Checkbox, select, and toggle.
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="flex flex-col gap-4">
                            <div className="flex items-center gap-2">
                                <Checkbox
                                    id="terms"
                                    checked={termsAccepted}
                                    onCheckedChange={(checked) =>
                                        setTermsAccepted(checked === true)
                                    }
                                />
                                <Label htmlFor="terms">
                                    Accept terms (Checkbox)
                                </Label>
                            </div>
                            <div className="grid gap-2">
                                <Label>Select</Label>
                                <Select defaultValue="react">
                                    <SelectTrigger className="w-full">
                                        <SelectValue placeholder="Pick a stack" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="react">
                                            React
                                        </SelectItem>
                                        <SelectItem value="vue">Vue</SelectItem>
                                        <SelectItem value="svelte">
                                            Svelte
                                        </SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="flex items-center gap-2">
                                <Toggle
                                    pressed={notifications}
                                    onPressedChange={setNotifications}
                                    aria-label="Toggle notifications"
                                >
                                    Notifications
                                </Toggle>
                                <span className="text-muted-foreground text-sm">
                                    Toggle
                                </span>
                            </div>
                        </CardContent>
                    </Card>

                    <Card>
                        <CardHeader>
                            <CardTitle>Overlays</CardTitle>
                            <CardDescription>
                                Dialog, dropdown menu, and tooltip.
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="flex flex-wrap items-center gap-3">
                            <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
                                <DialogTrigger asChild>
                                    <Button variant="outline">Open dialog</Button>
                                </DialogTrigger>
                                <DialogContent>
                                    <DialogHeader>
                                        <DialogTitle>Dialog</DialogTitle>
                                        <DialogDescription>
                                            Modal content built with Radix Dialog
                                            primitives.
                                        </DialogDescription>
                                    </DialogHeader>
                                    <DialogFooter>
                                        <Button
                                            variant="outline"
                                            onClick={() => setDialogOpen(false)}
                                        >
                                            Cancel
                                        </Button>
                                        <Button onClick={() => setDialogOpen(false)}>
                                            Continue
                                        </Button>
                                    </DialogFooter>
                                </DialogContent>
                            </Dialog>

                            <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                    <Button variant="outline" size="icon">
                                        <MoreHorizontal />
                                        <span className="sr-only">Menu</span>
                                    </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end">
                                    <DropdownMenuItem>Profile</DropdownMenuItem>
                                    <DropdownMenuItem>Settings</DropdownMenuItem>
                                    <DropdownMenuItem>Sign out</DropdownMenuItem>
                                </DropdownMenuContent>
                            </DropdownMenu>

                            <Tooltip>
                                <TooltipTrigger asChild>
                                    <Button variant="ghost">Tooltip</Button>
                                </TooltipTrigger>
                                <TooltipContent>
                                    <p>Helpful hint on hover</p>
                                </TooltipContent>
                            </Tooltip>
                        </CardContent>
                    </Card>

                    <Card>
                        <CardHeader>
                            <CardTitle>Loading</CardTitle>
                            <CardDescription>
                                Separator and skeleton placeholders.
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="flex flex-col gap-4">
                            <div className="space-y-2">
                                <Skeleton className="h-4 w-full" />
                                <Skeleton className="h-4 w-4/5" />
                                <Skeleton className="h-4 w-3/5" />
                            </div>
                            <Separator />
                            <p className="text-muted-foreground text-sm">
                                Content below the separator.
                            </p>
                        </CardContent>
                    </Card>
                </div>
            </div>
        </>
    );
}

ComponentsShowcase.layout = {
    breadcrumbs: [
        {
            title: 'Components',
            href: '/components',
        },
    ],
};
