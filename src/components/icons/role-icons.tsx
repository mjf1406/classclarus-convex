/** @format */

import {
    Crown,
    GraduationCap,
    Heart,
    Shield,
    User,
    UserCheck,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Badge, badgeVariants } from "@/components/ui/badge";
import type { VariantProps } from "class-variance-authority";

export function OwnerIcon(props: React.SVGProps<SVGSVGElement>) {
    return (
        <Crown
            {...props}
            className={cn(
                "text-amber-600 dark:text-amber-400",
                props.className
            )}
        />
    );
}

export function AdminIcon(props: React.SVGProps<SVGSVGElement>) {
    return (
        <Shield
            {...props}
            className={cn("text-blue-600 dark:text-blue-400", props.className)}
        />
    );
}

export function TeacherIcon(props: React.SVGProps<SVGSVGElement>) {
    return (
        <User
            {...props}
            className={cn(
                "text-purple-600 dark:text-purple-400",
                props.className
            )}
        />
    );
}

export function AssistantTeacherIcon(props: React.SVGProps<SVGSVGElement>) {
    return (
        <UserCheck
            {...props}
            className={cn("text-cyan-600 dark:text-cyan-400", props.className)}
        />
    );
}

export function GuardianIcon(props: React.SVGProps<SVGSVGElement>) {
    return (
        <Heart
            {...props}
            className={cn("text-pink-600 dark:text-pink-400", props.className)}
        />
    );
}

export function StudentIcon(props: React.SVGProps<SVGSVGElement>) {
    return (
        <GraduationCap
            {...props}
            className={cn(
                "text-green-600 dark:text-green-400",
                props.className
            )}
        />
    );
}

// Role Badge Components
interface RoleBadgeProps extends Omit<React.ComponentProps<"span">, "variant"> {
    variant?: VariantProps<typeof badgeVariants>["variant"];
    className?: string;
}

export function OwnerBadge({
    className,
    variant = "outline",
    ...props
}: RoleBadgeProps) {
    return (
        <Badge
            variant={variant}
            className={cn(
                "gap-1 border-amber-600 dark:border-amber-400 text-amber-600 dark:text-amber-400",
                className
            )}
            {...props}
        >
            <OwnerIcon className="size-3" />
            Owner
        </Badge>
    );
}

export function AdminBadge({
    className,
    variant = "outline",
    ...props
}: RoleBadgeProps) {
    return (
        <Badge
            variant={variant}
            className={cn(
                "gap-1 border-blue-600 dark:border-blue-400 text-blue-600 dark:text-blue-400",
                className
            )}
            {...props}
        >
            <AdminIcon className="size-3" />
            Admin
        </Badge>
    );
}

export function TeacherBadge({
    className,
    variant = "outline",
    ...props
}: RoleBadgeProps) {
    return (
        <Badge
            variant={variant}
            className={cn(
                "gap-1 border-purple-600 dark:border-purple-400 text-purple-600 dark:text-purple-400",
                className
            )}
            {...props}
        >
            <TeacherIcon className="size-3" />
            Teacher
        </Badge>
    );
}

export function AssistantTeacherBadge({
    className,
    variant = "outline",
    ...props
}: RoleBadgeProps) {
    return (
        <Badge
            variant={variant}
            className={cn(
                "gap-1 border-cyan-600 dark:border-cyan-400 text-cyan-600 dark:text-cyan-400",
                className
            )}
            {...props}
        >
            <AssistantTeacherIcon className="size-3" />
            Assistant Teacher
        </Badge>
    );
}

export function StudentBadge({
    className,
    variant = "outline",
    ...props
}: RoleBadgeProps) {
    return (
        <Badge
            variant={variant}
            className={cn(
                "gap-1 border-green-600 dark:border-green-400 text-green-600 dark:text-green-400",
                className
            )}
            {...props}
        >
            <StudentIcon className="size-3" />
            Student
        </Badge>
    );
}

export function GuardianBadge({
    className,
    variant = "outline",
    ...props
}: RoleBadgeProps) {
    return (
        <Badge
            variant={variant}
            className={cn(
                "gap-1 border-pink-600 dark:border-pink-400 text-pink-600 dark:text-pink-400",
                className
            )}
            {...props}
        >
            <GuardianIcon className="size-3" />
            Guardian
        </Badge>
    );
}
