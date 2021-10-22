import { Component, OnInit, ViewChild } from '@angular/core';
import { MatDialog } from '@angular/material/dialog';
import { HttpClient } from '@angular/common/http';
import { Router } from "@angular/router";

import { MatPaginator } from '@angular/material/paginator';
import { merge, Observable, of as observableOf } from 'rxjs';
import { catchError, map, startWith, switchMap } from 'rxjs/operators';

import { QrCodeDialog } from './dashboard-qrcode';
import { DeleteDialog } from './dashboard-delete';
import { PskDialog } from './dashboard-psk';
import { EmailDialog } from './dashboard-email';
import { ErrorDialog } from './dashboard-error';


import { ConnectorService } from '../connector.service';
import { MatTableDataSource } from '@angular/material/table';
import { MatSnackBar, MatSnackBarHorizontalPosition, MatSnackBarVerticalPosition } from '@angular/material/snack-bar';
import { WarningDialog } from './dashboard-warning';

export interface PskElement {
  id: string;
  name: string;
  ssid: string;
  created_by: string;
  created_time: number;
  modified_time: number;
  passphrase: string;
  user_email: string;
  expire_time: number;
}

export interface MistPsks {
  results: PskElement[];
  total: number;
  limiit: number;
  page: number;
}

export class MistHttpDatabase {
  constructor(private _httpClient: HttpClient) { }

  loadPsks(body: {}, pageIndex: number, pageSize: number): Observable<MistPsks> {
    body["page"] = pageIndex;
    body["limit"] = pageSize;
    return this._httpClient.post<MistPsks>('/api/psks/', body);
  }
}

@Component({
  selector: 'app-dashboard',
  templateUrl: './dashboard.component.html',
  styleUrls: ['./dashboard.component.css']
})


export class DashboardComponent implements OnInit {


  headers = {};
  cookies = {};
  self = {};
  search = "";
  sites = [];
  wlans = [];
  site_id: string = "";
  sitegroups_ids: string[] = [];
  default_expire_time: number = null;
  psk_length: number = 12;
  ssid: string = "";
  me: string = "";
  now: number;

  sitesHidden: boolean = true;
  sitesDisabled: boolean = true;

  wlansDisabled: boolean = true;
  createDisabled: boolean = true;

  topBarLoading = false;
  loading = false;

  isRateLimitReached = false;
  pskDatabase: MistHttpDatabase | null;
  filteredPskDatase: MatTableDataSource<PskElement> | null;
  psks: PskElement[] = []

  filters_enabled: boolean = false
  resultsLength = 0;
  displayedColumns: string[] = ['status', 'name', 'user_email', 'ssid', 'created_by', 'expire_time', 'action'];

  @ViewChild(MatPaginator) paginator: MatPaginator;

  constructor(private _http: HttpClient, private _appService: ConnectorService, public _dialog: MatDialog, private _snackBar: MatSnackBar, private _router: Router) { }

  ngOnInit() {
    this._appService.headers.subscribe(headers => this.headers = headers)
    this._appService.cookies.subscribe(cookies => this.cookies = cookies)
    this._appService.self.subscribe(self => this.self = self || {})

    this.me = this.self["email"] || null
    this.getConfig()
    if (!this.me) this._router.navigateByUrl("/")
    if (this.self != {} && this.self["privileges"]) {
      this.self["privileges"].forEach(element => {
        if (element["scope"] == "org") {
          this.sitesHidden = false
          this.changeOrg()
        } else if (element["scope"] == "site") {
          this.sites.push({ id: element["site_id"], name: element["name"] })
        }
      });
      if (this.sites.length == 1) {
        this.site_id = this.sites[0]["id"]
        this.sitesHidden = true
        this.changeSite()
      }
    }
  }

  //////////////////////////////////////////////////
  // CONFIG
  parsePskConfig(data): void {
    if (data.psk_length) {
      this.psk_length = data.psk_length
    }
    if (data.default_expire_time) {
      this.default_expire_time = data.default_expire_time
    }
  }

  getConfig() {
    this._http.get<PskElement[]>('/api/psks/config').subscribe({
      next: data => this.parsePskConfig(data),
      error: error => {
        var message: string = "There was an error... "
        if ("error" in error) { message += error["error"]["message"] }
        this.openError(message)
      }
    })
  }

  //////////////////////////////////////////////////
  // PSK
  getPsks() {
    this.now = Math.trunc(Date.now() / 1000);
    var body = null
    if (this.site_id == "org") {
      body = { cookies: this.cookies, headers: this.headers, ssid: this.ssid, full: this.filters_enabled }
    } else if (this.site_id) {
      body = { cookies: this.cookies, headers: this.headers, site_id: this.site_id, ssid: this.ssid, full: this.filters_enabled }
    }
    if (body) {

      if (this.filters_enabled) {
        this.loading = true;
        this._http.post<PskElement[]>('/api/psks/', body).subscribe({
          next: data => {
            this.filteredPskDatase = new MatTableDataSource(data["results"]);
            this.filteredPskDatase.paginator = this.paginator;
            this.loading = false;
          },
          error: error => {
            var message: string = "There was an error... "
            if ("error" in error) { message += error["error"]["message"] }
            this.openError(message)
          }
        })

      } else {
        this.pskDatabase = new MistHttpDatabase(this._http);
        merge(this.paginator.page, this.paginator.pageSize)
          .pipe(
            startWith({}),
            switchMap(() => {
              this.loading = true;
              return this.pskDatabase!.loadPsks(body, this.paginator.pageIndex, this.paginator.pageSize);
            }),
            map(data => {
              // Flip flag to show that loading has finished.
              this.loading = false;
              this.isRateLimitReached = false;
              this.resultsLength = data.total;
              return data.results;
            }),
            catchError(() => {
              // Catch if the GitHub API has reached its rate limit. Return empty data.
              this.isRateLimitReached = true;
              return observableOf([]);
            })
          ).subscribe(data => this.psks = data);
      }
    }
  }

  //////////////////////////////////////////////////
  // WLANS

  changeWlan() {
    this.getPsks()
  }

  parseWlans(data) {
    this.wlans = data.wlans;
    if (data.wlans.length == 1) {
      this.ssid = this.wlans[0];
      this.getPsks();
    }
    else if (data.wlans.length > 0) {
      this.wlans.sort();
      this.getPsks()
    }
    this.wlansDisabled = false;
    this.topBarLoading = false;
  }


  //////////////////////////////////////////////////
  // SITES

  changeSite() {
    this.topBarLoading = true;
    var body = null
    this.createDisabled = false;
    this.sitegroups_ids = [];
    if (this.site_id == "org") {
      body = {
        cookies: this.cookies,
        headers: this.headers,
      }
    } else if (this.site_id) {
      this.sites.forEach(site => {
        if (site.id == this.site_id) {
          this.sitegroups_ids = site.sitegroups_ids;
        }
      })
      body = {
        cookies: this.cookies,
        headers: this.headers,
        site_id: this.site_id,
        sitegroups_ids: this.sitegroups_ids,
      }
    }
    if (body) {
      this._http.post<any>('/api/wlans/', body).subscribe({
        next: data => this.parseWlans(data),
        error: error => {
          var message: string = "There was an error... "
          if ("error" in error) { message += error["error"]["message"] }
          this.topBarLoading = false;
          this.openError(message)
        }
      })
    }
  }

  parseSites(data) {
    if (data.sites.length > 0) {
      this.sites = this.sortList(data.sites, "name");
    }
    this.sitesDisabled = false;
    this.topBarLoading = false;
  }


  //////////////////////////////////////////////////
  // ORGS

  changeOrg() {
    this.topBarLoading = true;
    this._http.post<any>('/api/sites/', { cookies: this.cookies, headers: this.headers }).subscribe({
      next: data => this.parseSites(data),
      error: error => {
        var message: string = "There was an error... "
        if ("error" in error) {
          message += error["error"]["message"]
        }
        this.topBarLoading = false;
        this.openError(message)
      }
    })
  }



  //////////////////////////////////////////////////
  // COMMON
  sortList(data, attribute) {
    return data.sort(function (a, b) {
      var nameA = a[attribute].toUpperCase(); // ignore upper and lowercase
      var nameB = b[attribute].toUpperCase(); // ignore upper and lowercase
      if (nameA < nameB) {
        return -1;
      }
      if (nameA > nameB) {
        return 1;
      }
      return 0;
    })
  }
  applyFilter(event: Event) {
    const filterValue = (event.target as HTMLInputElement).value.trim().toLowerCase();
    this.filteredPskDatase.filter = filterValue.trim().toLowerCase();

    if (this.filteredPskDatase.paginator) {
      this.filteredPskDatase.paginator.firstPage();
    }
  }


  // DIALOG BOXES
  // ERROR
  openError(message: string): void {
    const dialogRef = this._dialog.open(ErrorDialog, {
      data: message
    });
  }



  // QRCODE DIALOG
  openQrcode(psk: PskElement): void {
    const dialogRef = this._dialog.open(QrCodeDialog, {
      data: { ssid: psk.ssid, passphrase: psk.passphrase }
    });
  }




  // CREATE DIALOG
  openCreate(): void {
    let expire_time = null;
    if (this.default_expire_time) {
      expire_time = Date.now() + this.default_expire_time * 3600000;
    }
    var newPsk: PskElement = {
      id: null,
      name: "",
      ssid: this.ssid,
      passphrase: "",
      expire_time: expire_time,
      created_by: this.me,
      created_time: null,
      modified_time: null,
      user_email: null
    };
    const dialogRef = this._dialog.open(PskDialog, {
      data: { wlans: this.wlans, psk: newPsk, editing: false, default_expire_time: this.default_expire_time, psk_length: this.psk_length }
    })
    dialogRef.afterClosed().subscribe(result => {
      if (result) {
        var body = null;
        if (this.site_id == "org") {
          body = {
            cookies: this.cookies,
            headers: this.headers,
            user_email: result.user_email,
            name: result.name,
            passphrase: result.psk,
            expire_time: result.expire_time,
            ssid: result.ssid,
            vlan_id: result.vlan_id,
            created_by: this.me,
            renewable: result.renewable
          }
        } else if (this.site_id) {
          body = {
            cookies: this.cookies,
            headers: this.headers,
            site_id: this.site_id,
            user_email: result.user_email,
            name: result.name,
            passphrase: result.psk,
            expire_time: result.expire_time,
            ssid: result.ssid,
            vlan_id: result.vlan_id,
            created_by: this.me,
            renewable: result.renewable
          }
        }
        this._http.post<any>('/api/psks/create/', body).subscribe({
          next: data => {
            this.getPsks()
            this.openSnackBar("PSK " + result.name + " successfully created", "Done")
          },
          error: error => {
            var message: string = "Unable to create PSK " + result.name + "... "
            if ("error" in error) { message += error["error"]["message"] }
            this.openError(message)
          }
        })
      }
    })
  }
  // EDIT PSK
  openEdit(psk: PskElement): void {
    const dialogRef = this._dialog.open(PskDialog, {
      data: { wlans: this.wlans, psk: psk, editing: true, default_expire_time: this.default_expire_time, psk_length: this.psk_length }
    })
    dialogRef.afterClosed().subscribe(result => {
      if (result) {
        var body = null;
        if (this.site_id == "org") {
          body = {
            cookies: this.cookies,
            headers: this.headers,
            id: result.id,
            user_email: result.user_email,
            name: result.name,
            passphrase: result.psk,
            expire_time: result.expire_time,
            ssid: result.ssid,
            vlan_id: result.vlan_id,
            created_by: this.me,
            renewable: result.renewable
          }
        } else if (this.site_id) {
          body = {
            cookies: this.cookies,
            headers: this.headers,
            site_id: this.site_id,
            id: result.id,
            user_email: result.user_email,
            name: result.name,
            passphrase: result.psk,
            expire_time: result.expire_time,
            ssid: result.ssid,
            vlan_id: result.vlan_id,
            created_by: this.me,
            renewable: result.renewable
          }
        }
        this._http.post<any>('/api/psks/create/', body).subscribe({
          next: data => {
            this.getPsks()
            this.openSnackBar("PSK " + result.name + " successfully updated", "Done")

          },
          error: error => {
            var message: string = "Unable to save changes to PSK " + psk.name + "... "
            if ("error" in error) { message += error["error"]["message"] }
            this.openError(message)
          }
        })
      }
    })
  }

  // DELETE DIALOG
  openDelete(psk: PskElement): void {
    const dialogRef = this._dialog.open(DeleteDialog, {
      data: psk
    });
    dialogRef.afterClosed().subscribe(result => {
      if (result) {
        var body = null;
        if (this.site_id == "org") {
          body = {
            cookies: this.cookies,
            headers: this.headers,
            psk_id: psk.id
          }
        } else if (this.site_id) {
          body = {
            cookies: this.cookies,
            headers: this.headers,
            site_id: this.site_id,
            psk_id: psk.id
          }
        }
        this._http.post<any>('/api/psks/delete/', body).subscribe({
          next: data => {
            this.getPsks()
            this.openSnackBar("PSK " + psk.name + " successfully deleted", "Done")
          },
          error: error => {
            var message: string = "Unable to delete the PSK" + psk.name + "... "
            if ("error" in error) { message += error["error"]["message"] }
            this.openError(message)
          }
        })
      }
    });
  }
  // EMAIL DIALOG
  openEmail(psk: PskElement): void {
    const dialogRef = this._dialog.open(EmailDialog, {
      data: psk
    });
    dialogRef.afterClosed().subscribe(result => {
      if (result) {
        this._http.post<any>('/api/psks/email/', { name: result.name, user_email: result.user_email, psk: psk.passphrase, ssid: psk.ssid }).subscribe({
          next: data => {
            this.getPsks()
            this.openSnackBar("Email sent to" + psk.user_email, "Done")
          },
          error: error => {
            var message: string = "Unable to send the email to " + result.user_email + "... "
            if ("error" in error) { message += error["error"]["message"] }
            this.openError(message)
          }
        })
      }
    });
  }

  // SNACK BAR
  openSnackBar(message: string, action: string) {
    this._snackBar.open(message, action, {
      duration: 5000,
      horizontalPosition: "center",
      verticalPosition: "top",
    });
  }
}

