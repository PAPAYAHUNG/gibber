import {
    BellIcon,
    HomeIcon,
    MagnifyingGlassIcon,
    PencilIcon,
    UserCircleIcon,
} from "@heroicons/react/24/outline";
import classNames from "classnames";
import { useAtom } from "jotai";
import Link from "next/link";
import { useRouter } from "next/router";
import { signIn, useSession } from "next-auth/react";

import Background from "../../../assets/bottom-bar.svg";
import { createPostAtom } from "../../atoms";
import { useProfile } from "../../utils/use-profile";
import Button from "../button";

const defaultClassName =
    "fixed left-6 right-6 bottom-4 left-1/2 w-[330px] -translate-x-1/2";

const BottomBar: React.FC = () => {
    const { status: sessionStatus } = useSession();

    if (sessionStatus === "authenticated") {
        return <AuthedBottomBar />;
    }

    if (sessionStatus === "unauthenticated") {
        return <AuthBottomBar />;
    }

    return null;
};

const AuthBottomBar = () => {
    return (
        <div
            className={classNames(
                defaultClassName,
                "flex h-[60px] rounded-full border border-neutral-300 bg-neutral-100 opacity-95"
            )}
        >
            <div className="flex grow items-center gap-2 px-6">
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
};

const AuthedBottomBar = () => {
    const router = useRouter();
    const { profile } = useProfile();

    const [, setCreatePost] = useAtom(createPostAtom);

    const items = [
        {
            url: "/",
            icon: HomeIcon,
        },
        {
            url: "/search",
            icon: MagnifyingGlassIcon,
        },
        {
            url: "/notifications",
            icon: BellIcon,
        },
        {
            url: "/" + (profile.data ? profile.data.username : ""),
            icon: UserCircleIcon,
        },
    ];

    const links = items.map((item) => (
        <Link
            className={classNames("p-2", {
                "text-red-700": item.url === router.asPath,
            })}
            href={item.url}
            key={item.url}
        >
            <item.icon width={30} height={30} />
        </Link>
    ));

    return (
        <div className={defaultClassName}>
            <div className="absolute top-1/2 flex w-full -translate-y-1/2 justify-between px-4">
                {links}
            </div>
            <Button
                color="secondary"
                iconOnly
                className="absolute left-1/2 -top-[25px] h-[50px] w-[50px] -translate-x-1/2 border border-neutral-300"
                onClick={() => setCreatePost(true)}
            >
                <PencilIcon width={28} height={28} />
            </Button>
            <Background />
        </div>
    );
};

export default BottomBar;
