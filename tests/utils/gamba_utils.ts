import * as anchor from '@project-serum/anchor';
import { Connection, Keypair, PublicKey, SystemProgram } from "@solana/web3.js";
import { Program } from "@project-serum/anchor";
import { Wallet } from '@project-serum/anchor/dist/cjs/provider';
import { Gamba } from "../../target/types/gamba";
import { TypeDef } from '@project-serum/anchor/dist/cjs/program/namespace/types';


const program = anchor.workspace.Gamba as Program<Gamba>;

export enum BetChoice {
    Low,
    High
}

export class GambaUtils {
  
    conn: Connection;
    wallet: Wallet;
    program: Program<Gamba>;
  
    constructor(conn: Connection, wallet: Wallet, program: Program<Gamba>, devnet: boolean) {
      this.conn = conn;
      this.wallet = wallet;
      this.program = program;
    }

    public async init_gamba(): Promise<[PublicKey, number]> {
        const [_gamba_pda, _gamba_bump] = await this.find_gamba_address();

        const tx = await this.program.rpc.initializeGamba(
        _gamba_bump , 
        this.wallet.publicKey, { 
            accounts: {
            gambaAccount: _gamba_pda,
            authority: this.wallet.publicKey,
            systemProgram: SystemProgram.programId,
        },
        });

        return [_gamba_pda, _gamba_bump];
    }

    public async init_user(user: Keypair, name: String): Promise<[PublicKey, number]> {
        const [_gamba_pda, _gamba_bump] = await this.find_gamba_address();

        const [_user_account_pda, _user_account_bump] = await PublicKey.findProgramAddress(
        [ user.publicKey.encode().reverse(),
            Buffer.from(anchor.utils.bytes.utf8.encode("user_account"))],
        this.program.programId
        );

        const tx = await this.program.rpc.initializeUser(
            _gamba_bump,
            _user_account_bump, 
            name, 
            user.publicKey,
            { 
                accounts: {
                    userAccount: _user_account_pda,
                    gambaAccount: _gamba_pda,
                    authority: user.publicKey,
                    systemProgram: SystemProgram.programId,
                }, 
                signers: [ user ]
            }
        );

        return [_user_account_pda, _user_account_bump];
    }
    public async init_epoch(epoch: number, admin: Wallet): Promise<[PublicKey,number]> {
        const [epoch_pda, epoch_bump] = await this.find_epoch_address(epoch);
        const [gamba_pda, gamba_bump] = await this.find_gamba_address();

        const tx = await this.program.rpc.initializeEpoch(
        epoch,
        epoch_bump,
        gamba_bump,
        { 
            accounts: {
                epochAccount: epoch_pda,
                gambaAccount: gamba_pda,
                authority: admin.publicKey,
                systemProgram: SystemProgram.programId,
            },
        });
        return [epoch_pda, epoch_bump];
    }

    public async make_bet(userWallet: Keypair, lamports: number, epoch: number): Promise<string> {
        const [gamba_pda, gamba_bump] = await this.find_gamba_address();
        const [bet_pda, bet_bump] = await this.find_bet_address(userWallet.publicKey, epoch);
        const [epoch_pda, epoch_bump] = await this.find_epoch_address(epoch);

        let bet_type = { twoFold:{}}
        let bet_choice = { low:{}}

        const tx = await this.program.rpc.bet(
            bet_bump,
            gamba_bump, 
            epoch_bump,
            epoch, 
            userWallet.publicKey,
            bet_type,
            bet_choice,
            lamports,
            { 
                accounts: {
                    betAccount: bet_pda,
                    gambaAccount: gamba_pda,
                    epochAccount: epoch_pda,
                    user: userWallet.publicKey,
                    systemProgram: SystemProgram.programId,
                }, 
                signers: [ userWallet ]
            }
        );

        return tx;

    }

    //returns balance of account
    public async request_air_drop(addr: PublicKey, lamports: number): Promise<Number> {
        await this.conn.requestAirdrop(addr, lamports);
        let bal = 0;
        let backoff = 500;
        while (bal == 0) {
            bal = await this.conn.getBalance(addr);
            await new Promise(resolve => setTimeout(resolve,backoff));
            backoff *= 1.1;
            // console.log("waiting ", backoff, "ms to check balance");
        }
        return bal;
    }

    public async find_user_address(walletPubkey: PublicKey): Promise<[PublicKey, number]> {
        return await PublicKey.findProgramAddress(
        [ walletPubkey.encode().reverse(),
            Buffer.from(anchor.utils.bytes.utf8.encode("user_account"))],
        this.program.programId
        );
    }

    public async find_bet_address(walletPubkey: PublicKey, epoch: number): Promise<[PublicKey, number]> {
        return await PublicKey.findProgramAddress(
        [   walletPubkey.encode().reverse(),
            Buffer.from(anchor.utils.bytes.utf8.encode("bet")),
            Buffer.from(new Int32Array([epoch]).buffer)
        ],
        this.program.programId
        );
    }

    public async find_epoch_address(epoch: number): Promise<[PublicKey, number]> {
        return await PublicKey.findProgramAddress(
        [   Buffer.from(new Int32Array([epoch]).buffer),
            Buffer.from(anchor.utils.bytes.utf8.encode("epoch_account")),
        ],
        this.program.programId
        );
    }

    public async find_gamba_address(): Promise<[PublicKey, number]> {
        return await PublicKey.findProgramAddress(
        [ Buffer.from(anchor.utils.bytes.utf8.encode("gamba"))],
        this.program.programId
        );
    }
}