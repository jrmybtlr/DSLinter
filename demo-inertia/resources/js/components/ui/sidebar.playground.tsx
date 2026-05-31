import { definePlayground } from 'dslinter';

export const sidebarPlayground = definePlayground({
    render: () => (
        <div className="bg-sidebar text-sidebar-foreground w-[240px] rounded-lg border p-4">
            <p className="mb-2 text-sm font-medium">Sidebar preview</p>
            <p className="text-muted-foreground text-xs">
                Full sidebar layout requires SidebarProvider in the app shell.
                This stub shows sidebar tokens and spacing.
            </p>
        </div>
    ),
});
