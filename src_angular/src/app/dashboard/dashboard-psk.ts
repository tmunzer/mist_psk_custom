import { Component, Inject } from '@angular/core';
import { MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { FormBuilder, Validators, FormControl } from '@angular/forms';
import * as _moment from 'moment';
const moment = _moment;


@Component({
    selector: 'dashboard-psk',
    templateUrl: 'dashboard-psk.html',
})

export class PskDialog {


    passwordFieldType = "password";
    frmPsk = this.formBuilder.group({
        id: [this.data.psk.id],
        name: [this.data.psk.name, Validators.required],
        psk: [this.data.psk.passphrase, [Validators.minLength(8), Validators.maxLength(63)]],
        ssid: [this.data.psk.ssid, Validators.required],
        expire_time: [(this.data.psk.expire_time)],
        user_email: [this.data.psk.user_email, Validators.email],

    });

    editing = this.data.editing;
    default_expire_time = this.data.default_expire_time;
    expire_method = "none";
    psk_length = this.data.psk_length;
    duration: number = 1;
    duration_period: string = "days";


    public date: moment.Moment = moment();
    public min_date: moment.Moment = moment();
    dateControl = new FormControl(moment());

    constructor(public dialogRef: MatDialogRef<PskDialog>, @Inject(MAT_DIALOG_DATA) public data, private formBuilder: FormBuilder) { }

    ngOnInit() {
        if (!this.data.editing && this.data.default_expire_time) {
            this.expire_method = "date";
            this.dateControl = new FormControl(moment().add(this.data.default_expire_time, 'h'))
        } else if (this.data.psk.expire_time) {
            this.expire_method = "date";
            this.dateControl = new FormControl(moment(this.data.psk.expire_time*1000))
        } else if (this.data.default_expire_time) {
            this.dateControl = new FormControl(moment().add(this.data.default_expire_time, 'h'))
        }
    }

    confirm() {
        if (this.expire_method == "none") {
            this.frmPsk.controls["expire_time"].setValue(null)
        } else if (this.expire_method == "duration") {
            let expire = moment().add(this.duration as moment.DurationInputArg1, this.duration_period as moment.DurationInputArg2).unix()
            this.frmPsk.controls["expire_time"].setValue(expire)
        } else if (this.expire_method == "date") {
            let expire = this.dateControl.value.unix() 
            this.frmPsk.controls["expire_time"].setValue(expire)
        }
        this.dialogRef.close(this.frmPsk.value)
    }
    cancel(): void {
        this.dialogRef.close();
    }

    generatePsk() {
        const possible = "abcdefghjkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789";
        let text = "";
        for (let i = 0; i < this.psk_length; i++) {
            text += possible.charAt(Math.floor(Math.random() * possible.length));
        }
        this.frmPsk.controls["psk"].setValue(text);
    }

    toggleShowPassword(): void {
        if (this.passwordFieldType == 'password') {
            this.passwordFieldType = "text";
        } else {
            this.passwordFieldType = "password";
        }
    }


}