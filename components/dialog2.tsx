"use client"

import { Dialog, DialogContent, DialogTitle } from "./ui/dialog"

interface CreatePostDialogProps {
    open: boolean
    onOpenChange: (open: boolean) => void;
}

export function CreatePostDialog({ open, onOpenChange }: CreatePostDialogProps){
    return (
        <div>
           <Dialog>
            <DialogContent>
                <DialogTitle>
                    <h1 className="">Choose what to write about</h1>
                </DialogTitle>
            </DialogContent>
            </Dialog> 
        </div>
    )
}