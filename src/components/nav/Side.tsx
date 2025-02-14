import {
    BellIcon,
    ChevronUpDownIcon,
    Cog6ToothIcon,
    HomeIcon,
    MagnifyingGlassIcon,
    UserIcon,
} from "@heroicons/react/24/outline";
import { UserIcon as SolidUserIcon } from "@heroicons/react/24/solid";
import classNames from "classnames";
import { useAtom } from "jotai";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/router";
import { signIn, useSession } from "next-auth/react";
import { useEffect, useRef } from "react";
import { Transition } from "react-transition-group";
import {
    ENTERED,
    ENTERING,
    EXITED,
    EXITING,
} from "react-transition-group/Transition";

import Logo from "../../../assets/gibber.svg";
import { navOpenAtom } from "../../atoms";
import { clearProfileId, useProfile } from "../../utils/use-profile";
import Button from "../button";
import CloseButton from "../button/CloseButton";
import Sidebar from "../Sidebar";
import Topbar from "../Topbar";

// Make sure you change the tailwind duration too,
// literal values are not allowed.
const duration = 125;
const defaultClassName = `
    absolute top-0 bottom-0 left-0 right-0
    duration-[125ms] ease-[cubic-bezier(0.5, 0.25, 0, 1)] transition-all
    z-10
`;

type HeroIcon = (props: React.ComponentProps<"svg">) => JSX.Element;

interface INavItem {
    url: string;
    text: string;
    icon: HeroIcon;
    auth: boolean;
}

interface ISideProps {
    className?: string;
    type: "mobile" | "desktop";
}

const Side: React.FC<ISideProps> = ({ className, type }) => {
    const router = useRouter();

    const [navOpen, setNavOpen] = useAtom(navOpenAtom);
    const nodeRef = useRef(null);

    useEffect(() => {
        const onChange = () => setNavOpen(false);

        router.events.on("routeChangeStart", onChange);

        return () => router.events.off("routeChangeStart", onChange);
    }, [router.events, setNavOpen]);

    if (type === "desktop") {
        return <Content className={className} state={ENTERED} type={type} />;
    }

    return (
        <Transition nodeRef={nodeRef} in={navOpen} timeout={duration}>
            {(state: string) =>
                state !== EXITED && (
                    <div ref={nodeRef}>
                        <Mask state={state} />
                        <Content
                            className={className}
                            state={state}
                            type={type}
                        />
                    </div>
                )
            }
        </Transition>
    );
};

const Mask: React.FC<{ state: string }> = ({ state }) => {
    const [, setNavOpen] = useAtom(navOpenAtom);

    const className = classNames(defaultClassName, "bg-black", {
        "opacity-0": [ENTERING, EXITING].includes(state),
        "opacity-40": ENTERED === state,
    });

    return <div className={className} onClick={() => setNavOpen(false)} />;
};

const Content: React.FC<{
    className?: string;
    state: string;
    type: "mobile" | "desktop";
}> = (props) => {
    const { state, type } = props;
    const { profile } = useProfile();
    const router = useRouter();
    const { status: sessionStatus } = useSession();
    const [, setNavOpen] = useAtom(navOpenAtom);

    const className = classNames(props.className, {
        [defaultClassName]: type === "mobile",
        "-translate-x-full skew-y-6": [ENTERING, EXITING].includes(state),
        "translate-x-0": state === ENTERED,
    });

    const sidebarItems: INavItem[] = [
        {
            url: "/",
            text: "Home",
            icon: HomeIcon,
            auth: false,
        },
        {
            url: "/search",
            text: "Search",
            icon: MagnifyingGlassIcon,
            auth: false,
        },
        {
            url: "/notifications",
            text: "Notifications",
            icon: BellIcon,
            auth: true,
        },
        {
            url: "/" + (profile.data ? profile.data.username : ""),
            text: "Profile",
            icon: UserIcon,
            auth: true,
        },
        {
            url: "/settings",
            text: "Settings",
            icon: Cog6ToothIcon,
            auth: true,
        },
    ];

    const activeItems = sidebarItems.filter(
        (item) => !item.auth || sessionStatus === "authenticated"
    );

    const items = activeItems.map((item) => (
        <Link
            className={classNames(
                "flex h-[45px] items-center justify-end rounded bg-gradient-to-r hover:from-neutral-100",
                {
                    "text-red-700": item.url === router.asPath,
                }
            )}
            href={item.url}
            key={"side-bar" + item.url + item.text}
        >
            <p className="mr-6 text-xl md:hidden xl:block">{item.text}</p>
            <item.icon width={30} height={30} />
        </Link>
    ));

    const top =
        activeItems
            .map((item) => {
                return item.url;
            })
            .indexOf(router.asPath) * 45;

    return (
        <Sidebar className={className} type={type}>
            <Topbar mobileOnly>
                <Logo width={40} height={40} />
                <CloseButton
                    className="ml-auto"
                    onClick={() => setNavOpen(false)}
                />
            </Topbar>
            <div className="mt-12 flex grow flex-col px-8">
                {type === "desktop" && (
                    <Logo width={75} height={75} className="self-end" />
                )}
                {type === "mobile" && <AuthCard type={type} />}
                <div className="relative mt-16 grow">
                    {top >= 0 && (
                        <div
                            className="absolute top-[138px] -right-8 h-[45px] rounded border-r-2 border-red-700"
                            style={{ top: top.toString() + "px" }}
                        />
                    )}
                    {items}
                </div>
                {type === "desktop" && <AuthCard type={type} />}
            </div>
        </Sidebar>
    );
};

const AuthCard: React.FC<{ type: "mobile" | "desktop" }> = ({ type }) => {
    const { status: sessionStatus } = useSession();

    const { profile } = useProfile();

    const className = classNames("flex", {
        "mb-4": type === "desktop",
    });

    if (sessionStatus === "unauthenticated") {
        return (
            <div
                className={classNames(
                    className,
                    "flex-col rounded border-2 border-neutral-100 px-6 py-5"
                )}
            >
                <p className="text-xl font-semibold">Welcome to Gibber!</p>
                <div className="mt-3.5 flex gap-2">
                    <Button className="w-1/2" onClick={() => void signIn()}>
                        Sign In
                    </Button>
                    <Button
                        color="primary-outline"
                        className="w-1/2"
                        onClick={() => void signIn()}
                    >
                        Register
                    </Button>
                </div>
            </div>
        );
    }

    return (
        <div
            className={classNames(
                className,
                "flex-col rounded bg-gradient-to-r p-2 hover:cursor-pointer hover:from-neutral-100"
            )}
            onClick={() => clearProfileId()}
        >
            <div className="flex items-center justify-end">
                <div className="mr-2 flex">
                    <ChevronUpDownIcon width={30} height={30} />
                </div>
                {profile.data?.avatar && (
                    <Image
                        className="rounded-full"
                        alt="Your avatar"
                        src={profile.data.avatar.url}
                        width={75}
                        height={75}
                    />
                )}
                {!profile.data?.avatar && (
                    <div className="h-[75px] w-[75px] rounded-full bg-neutral-200">
                        <SolidUserIcon className="m-[25%] w-1/2 text-neutral-400" />
                    </div>
                )}
            </div>
            <p className="mt-2 text-end text-lg empty:before:inline-block empty:before:content-[''] md:hidden xl:block">
                {profile.data?.username}
            </p>
        </div>
    );
};

export default Side;
