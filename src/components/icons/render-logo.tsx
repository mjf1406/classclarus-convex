/** @format */

import { cn } from "@/lib/utils";

interface RenderLogoProps {
    icon?: string;
    /**
     * Size of the icon. Can be a Tailwind size class (e.g., "size-10", "size-16", "w-8 h-8")
     * or a preset size ("sm", "md", "lg").
     * @default "size-12"
     */
    size?: string;
    /**
     * Corner styling. Can be a Tailwind rounded class (e.g., "rounded-full", "rounded-lg", "rounded-md")
     * or a preset ("none", "sm", "md", "lg", "full").
     * @default "rounded"
     */
    rounded?: string;
    /**
     * Additional className for the logo element (img or emoji container)
     */
    className?: string;
    /**
     * Alt text for image icons
     */
    alt?: string;
}

// Helper function to determine if icon is an image URL
function isImageIcon(icon?: string): boolean {
    if (!icon) return false;
    // Legacy icon: prefix values are treated as emoji (fallback)
    if (icon.startsWith("icon:")) return false;
    return (
        icon.startsWith("http://") ||
        icon.startsWith("https://") ||
        icon.startsWith("data:")
    );
}

// Convert preset sizes to Tailwind classes
function getSizeClass(size?: string): string {
    if (!size) return "size-12";

    // If it's already a Tailwind class, return it
    if (size.includes("size-") || size.includes("w-") || size.includes("h-")) {
        return size;
    }

    // Preset sizes
    const presetSizes: Record<string, string> = {
        sm: "size-8",
        md: "size-12",
        lg: "size-16",
    };

    return presetSizes[size] || size;
}

// Convert preset rounded values to Tailwind classes
function getRoundedClass(rounded?: string): string {
    if (!rounded) return "rounded";

    // If it's already a Tailwind rounded class, return it
    if (rounded.startsWith("rounded")) {
        return rounded;
    }

    // Preset rounded values
    const presetRounded: Record<string, string> = {
        none: "",
        sm: "rounded-sm",
        md: "rounded-md",
        lg: "rounded-lg",
        full: "rounded-full",
    };

    return presetRounded[rounded] || "rounded";
}

// Get font size in rem based on container size
function getFontSize(size?: string): string {
    if (!size) return "2.1rem"; // Default for size-12 (3rem * 0.7)

    // Extract numeric value from size classes (e.g., "size-24" -> 24)
    const sizeMatch = size.match(/(\d+)/);
    if (sizeMatch) {
        const sizeValue = parseInt(sizeMatch[1], 10);
        // Tailwind size-X = X/4 rem (size-24 = 24/4 = 6rem)
        // Use 70% of container size for emoji
        const containerSizeRem = sizeValue / 4;
        const fontSizeRem = containerSizeRem * 0.7;
        return `${fontSizeRem}rem`;
    }

    // Preset sizes (in rem, 70% of container)
    const presetFontSizes: Record<string, string> = {
        sm: "1.4rem", // size-8 = 2rem, 70% = 1.4rem
        md: "2.1rem", // size-12 = 3rem, 70% = 2.1rem
        lg: "2.8rem", // size-16 = 4rem, 70% = 2.8rem
    };

    return presetFontSizes[size] || "2.1rem";
}

export function RenderLogo({
    icon,
    size,
    rounded,
    className,
    alt = "Organization icon",
}: RenderLogoProps) {
    const isImage = isImageIcon(icon);

    // Default fallback emoji
    const displayIcon = icon && !icon.startsWith("icon:") ? icon : "🏢";

    const sizeClass = getSizeClass(size);
    const roundedClass = getRoundedClass(rounded);
    const fontSize = getFontSize(size);

    const logoContent = isImage ? (
        <img
            src={icon}
            alt={alt}
            className={cn("w-full h-full object-cover", className)}
        />
    ) : (
        <div
            className={cn(
                "w-full h-full flex items-center justify-center",
                className
            )}
            style={{
                fontSize: fontSize,
                lineHeight: "1",
            }}
        >
            {displayIcon}
        </div>
    );

    return <div className={cn(sizeClass, roundedClass)}>{logoContent}</div>;
}
