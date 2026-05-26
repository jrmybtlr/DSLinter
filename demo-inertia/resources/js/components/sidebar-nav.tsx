import { Link, type InertiaLinkProps } from '@inertiajs/react';
import type { ComponentPropsWithoutRef, ReactNode } from 'react';
import {
    SidebarGroup,
    SidebarGroupContent,
    SidebarGroupLabel,
    SidebarHeader,
    SidebarMenu,
    SidebarMenuBadge,
    SidebarMenuButton,
    SidebarMenuItem,
} from '@/components/ui/sidebar';
import { useCurrentUrl } from '@/hooks/use-current-url';
import { toUrl } from '@/lib/utils';
import type { NavItem } from '@/types';

type SidebarNavMenuProps = ComponentPropsWithoutRef<typeof SidebarMenu>;

export function SidebarNavMenu({ className, ...props }: SidebarNavMenuProps) {
    return <SidebarMenu className={className} {...props} />;
}

type SidebarNavLinkProps = {
    item: NavItem;
    buttonClassName?: string;
    iconClassName?: string;
    showTooltip?: boolean;
};

export function SidebarNavLink({
    item,
    buttonClassName,
    iconClassName,
    showTooltip = true,
}: SidebarNavLinkProps) {
    const { isCurrentUrl } = useCurrentUrl();
    const isActive = item.isActive ?? isCurrentUrl(item.href);
    const isExternal = item.external ?? false;

    const linkContent = (
        <>
            {item.icon && <item.icon className={iconClassName} />}
            <span>{item.title}</span>
        </>
    );

    return (
        <SidebarMenuItem>
            <SidebarMenuButton
                asChild
                isActive={isActive}
                tooltip={
                    showTooltip ? { children: item.title } : undefined
                }
                className={buttonClassName}
            >
                {isExternal ? (
                    <a
                        href={toUrl(item.href)}
                        target="_blank"
                        rel="noopener noreferrer"
                    >
                        {linkContent}
                    </a>
                ) : (
                    <Link href={item.href} prefetch>
                        {linkContent}
                    </Link>
                )}
            </SidebarMenuButton>
            {item.badge != null && (
                <SidebarMenuBadge>{item.badge}</SidebarMenuBadge>
            )}
        </SidebarMenuItem>
    );
}

type SidebarNavListProps = {
    items: NavItem[];
    buttonClassName?: string;
    iconClassName?: string;
    showTooltip?: boolean;
} & Omit<SidebarNavMenuProps, 'children'>;

export function SidebarNavList({
    items,
    buttonClassName,
    iconClassName,
    showTooltip = true,
    className,
    ...props
}: SidebarNavListProps) {
    return (
        <SidebarNavMenu className={className} {...props}>
            {items.map((item) => (
                <SidebarNavLink
                    key={item.title}
                    item={item}
                    buttonClassName={buttonClassName}
                    iconClassName={iconClassName}
                    showTooltip={showTooltip}
                />
            ))}
        </SidebarNavMenu>
    );
}

type SidebarNavSectionProps = ComponentPropsWithoutRef<typeof SidebarGroup> & {
    label?: string;
    showLabel?: boolean;
    items: NavItem[];
    buttonClassName?: string;
    iconClassName?: string;
    showTooltip?: boolean;
};

export function SidebarNavSection({
    label,
    showLabel = true,
    items,
    buttonClassName,
    iconClassName,
    showTooltip = true,
    className,
    children,
    ...props
}: SidebarNavSectionProps) {
    const menu = (
        <SidebarNavList
            items={items}
            buttonClassName={buttonClassName}
            iconClassName={iconClassName}
            showTooltip={showTooltip}
        />
    );

    return (
        <SidebarGroup className={className} {...props}>
            {showLabel && label ? (
                <SidebarGroupLabel>{label}</SidebarGroupLabel>
            ) : null}
            {showLabel === false || !label ? (
                <SidebarGroupContent>{menu}</SidebarGroupContent>
            ) : (
                menu
            )}
            {children}
        </SidebarGroup>
    );
}

type SidebarNavBrandProps = {
    href: NonNullable<InertiaLinkProps['href']>;
    logo: ReactNode;
    className?: string;
};

export function SidebarNavBrand({ href, logo, className }: SidebarNavBrandProps) {
    return (
        <SidebarHeader className={className}>
            <SidebarNavMenu>
                <SidebarMenuItem>
                    <SidebarMenuButton size="lg" asChild>
                        <Link href={href} prefetch>
                            {logo}
                        </Link>
                    </SidebarMenuButton>
                </SidebarMenuItem>
            </SidebarNavMenu>
        </SidebarHeader>
    );
}
