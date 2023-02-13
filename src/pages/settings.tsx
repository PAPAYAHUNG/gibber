import { type NextPage } from "next";
import Head from "next/head";
import { useState } from "react";

import Button from "../components/button";
import NavButton from "../components/button/NavButton";
import Modal from "../components/modal";
import TopBar from "../components/nav/TopBar";
import { api } from "../utils/api";
import { clearProfileId } from "../utils/use-profile";

const Settings: NextPage = () => {
    const [isDeleteModalOpen, setDeleteModalOpen] = useState<boolean>(false);

    const userDelete = api.user.delete.useMutation({
        onSuccess: () => clearProfileId(),
    });

    return (
        <>
            <Head>
                <title>Settings</title>
                <meta name="description" content="Gibber settings" />
                <link rel="icon" href="/favicon.ico" />
            </Head>
            <Modal
                isOpen={isDeleteModalOpen}
                title="Delete account"
                onClose={() => setDeleteModalOpen(false)}
            >
                <div className="mt-6 flex">
                    <div className="grow rounded bg-orange-50 p-4 text-orange-800">
                        <p>This cannot be undone.</p>
                    </div>
                </div>
                <div className="mt-6 flex">
                    <Button
                        className="grow"
                        onClick={() => userDelete.mutate()}
                    >
                        Confirm Deletion
                    </Button>
                </div>
            </Modal>
            <TopBar>
                <NavButton />
                <p className="ml-5 font-semibold">Settings</p>
            </TopBar>
            <div className="px-6">
                <div className="mt-6 flex">
                    <p>
                        Deleting your account will delete all your profiles,
                        posts, and user data.
                    </p>
                </div>
                <div className="mt-6 flex">
                    <Button
                        className="grow"
                        onClick={() => setDeleteModalOpen(true)}
                    >
                        Delete Account
                    </Button>
                </div>
                <hr className="my-6 h-px border-0 bg-neutral-200" />
            </div>
        </>
    );
};

export default Settings;