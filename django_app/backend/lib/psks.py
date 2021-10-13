
import requests
import json
import bcrypt
from .common import Common
from .wlans import Wlan


class Psk(Common):

    #############
    # get PSKs from Cloud
    #############
    def pull(self, body, host, org_id):
        body = self.get_body(body)
        if "site_id" in body:
            return self._pull_psks(body, "sites", "site_id", host, org_id)
        else:
            return self._pull_psks(body, "orgs", "org_id", host, org_id)
        # else:
        #     return {"status": 500, "data": {"message": "site_id or org_id missing"}}

    def _pull_psks(self, body, scope_name, scope_id_param, host, org_id):
        if scope_name == "sites":
            url = "https://{0}/api/v1/sites/{1}/psks".format(
                host, body[scope_id_param])
        else:
            url = "https://{0}/api/v1/orgs/{1}/psks".format(
                host, org_id)

        if url:
            try:
                extract = self.extractAuth(body)
                if "full" in body and body["full"]:
                    limit = 1000
                    page = 1
                    results = []
                    total = 1
                    while len(results) < int(total) and int(page) < 50:
                        url = url + "?limit={0}&page={1}".format(limit, page)
                        if "ssid" in body and body["ssid"]:
                            url += "&ssid={0}".format(body["ssid"])
                        resp = requests.get(
                            url, headers=extract["headers"], cookies=extract["cookies"])
                        results.extend(resp.json())
                        total = resp.headers["X-Page-Total"]
                        page += 1
                    return {"status": 200, "data": {"total": total, "results": results}}

                else:
                    limit = body["limit"] if "limit" in body else 100
                    page = body["page"] + 1 if "page" in body else 1
                    url = url+"?limit={0}&page={1}".format(limit, page)
                    if "ssid" in body and body["ssid"]:
                        url += "&ssid={0}".format(body["ssid"])
                    resp = requests.get(
                        url, headers=extract["headers"], cookies=extract["cookies"])
                    return {"status": 200, "data": {"page": resp.headers["X-Page-Page"], "limit": resp.headers["X-Page-limit"], "total": resp.headers["X-Page-Total"], "results": resp.json()}}
            except:
                return {"status": 500, "data": {"message": "Unable to retrieve the PSKs list"}}
        else:
            return {"status": 500, "data": {"message": "missing parameters in the request"}}


#############
# Create or Edit PSK
#############


    def push(self, body, host, org_id):
        body = self.get_body(body)
        if "site_id" in body:
            return self._push_psk(body, "sites", "site_id", host, org_id)
        else:
            return self._push_psk(body, "orgs", "org_id", host, org_id)
        # else:
        #     return {"status": 500, "data": {"message": "site_id or org_id missing"}}

    def _push_psk(self, body, scope_name, scope_id_param, host, org_id):
        if "name" in body and "passphrase" in body and "ssid" in body:
            extract = self.extractAuth(body)
            psk = {
                "name": body["name"],
                "passphrase": body["passphrase"],
                "ssid": body["ssid"],
                "expire_time": body["expire_time"],
                "usage": "multi",
            }
            if "created_by" in body:
                psk["created_by"] = body["created_by"]
            if "user_email" in body:
                psk["user_email"] = body["user_email"]

            result = {"status": None}
            if "id" in body:
                result = self._updatePsk(
                    body, extract, body["id"], psk, scope_name, scope_id_param, host, org_id)
            else:
                result = self._createPsk(
                    body, extract, psk, scope_name, scope_id_param, host, org_id)
            if "vlan_id" in body and result["status"] == 200:
                vlan_check = Wlan().check_vlan(
                    extract, body["ssid"], body["vlan_id"], scope_name, body[scope_id_param])
                result["data"]["vlan_check"] = vlan_check
            return result

    def _createPsk(self, body, extract, psk, scope_name, scope_id_param, host, org_id):
        try:
            if scope_name == "sites":
                url = "https://{0}/api/v1/sites/{1}/psks".format(
                    host, body[scope_id_param])
            else:
                url = "https://{0}/api/v1/orgs/{1}/psks".format(
                    host, org_id)
            resp = requests.post(
                url, headers=extract["headers"], cookies=extract["cookies"], json=psk)
            return {"status": 200, "data": {"results": resp.json()}}
        except:
            return {"status": 500, "data": {"message": "Unable to update the Psk"}}

    def _updatePsk(self, body, extract, psk_id, psk, scope_name, scope_id_param, host, org_id):
        try:
            if scope_name == "sites":
                url = "https://{0}/api/v1/sites/{1}/psks/{2}".format(
                    host, body[scope_id_param], body["id"])
            else:
                url = "https://{0}/api/v1/orgs/{1}/psks/{2}".format(
                    host, org_id, body["id"])
            resp = requests.put(
                url, headers=extract["headers"], cookies=extract["cookies"], json=psk)
            return {"status": 200, "data": {"results": resp.json()}}
        except:
            return {"status": 500, "data": {"message": "Unable to update the Psk"}}

#############
# delete PSKs
#############
    def delete(self, body, host, org_id):
        body = self.get_body(body)
        if "site_id" in body:
            return self._delete_psk(body, "sites", "site_id", host, org_id)
        else:
            return self._delete_psk(body, "orgs", "org_id", host, org_id)
        # else:
        #     return {"status": 500, "data": {"message": "site_id or org_id missing"}}

    def _delete_psk(self, body, scope_name, scope_id_param, host, org_id):
        extract = self.extractAuth(body)
        if "psk_id" in body:
            try:
                if scope_name == "sites":
                    url = "https://{0}/api/v1/sites/{1}/psks/{2}".format(
                        host, body[scope_id_param], body["psk_id"])
                else:
                    url = "https://{0}/api/v1/orgs/{1}/psks/{2}".format(
                        host, org_id, body["psk_id"])
                print(url)
                resp = requests.delete(
                    url, headers=extract["headers"], cookies=extract["cookies"])
                return {"status": 200, "data": {"result": resp.json()}}
            except:
                return {"status": 500, "data": {"message": "unable to delete the psk"}}

        else:
            return {"status": 500, "data": {"message": "psk_id is missing"}}
